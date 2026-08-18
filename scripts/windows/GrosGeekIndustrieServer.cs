using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("Serveur Gros Geek Industrie")]
[assembly: AssemblyDescription("Serveur local et lanceur de Gros Geek Industrie Publisher")]
[assembly: AssemblyCompany("Gros Geek Industrie")]
[assembly: AssemblyProduct("Gros Geek Industrie Publisher")]
[assembly: AssemblyVersion("1.0.0.0")]

internal static class GrosGeekServerTray
{
    private const string MutexName = "GrosGeekIndustriePublisher.ServerTray";
    private static readonly object LogLock = new object();
    private static readonly object ProcessLock = new object();

    private static Mutex singletonMutex;
    private static NotifyIcon trayIcon;
    private static MenuItem serverStateItem;
    private static MenuItem restartItem;
    private static Process serverProcess;
    private static bool shuttingDown;
    private static bool restarting;
    private static string projectRoot;
    private static string pythonExecutable;
    private static string appUrl;
    private static Bitmap trayBitmap;

    [STAThread]
    private static void Main(string[] args)
    {
        bool createdNew;
        singletonMutex = new Mutex(true, MutexName, out createdNew);
        if (!createdNew)
        {
            singletonMutex.Dispose();
            return;
        }

        projectRoot = ReadArgument(args, "--root");
        pythonExecutable = ReadArgument(args, "--python");

        if (string.IsNullOrWhiteSpace(projectRoot))
        {
            string executableDirectory = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            projectRoot = Directory.GetParent(executableDirectory).FullName;
        }

        if (string.IsNullOrWhiteSpace(pythonExecutable))
        {
            pythonExecutable = "pythonw.exe";
        }

        projectRoot = Path.GetFullPath(projectRoot);
        appUrl = ReadLocalAppUrl(projectRoot);

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        trayIcon = new NotifyIcon();
        trayIcon.Text = "Serveur Gros Geek Industrie";
        trayIcon.Icon = LoadTrayIcon();
        trayIcon.Visible = true;
        trayIcon.DoubleClick += delegate { OpenApplication(); };

        serverStateItem = new MenuItem("Serveur : démarrage…") { Enabled = false };
        restartItem = new MenuItem("Redémarrer le serveur", delegate { RestartServer(); });
        trayIcon.ContextMenu = new ContextMenu(new[]
        {
            serverStateItem,
            new MenuItem("Ouvrir l’application", delegate { OpenApplication(); }),
            restartItem,
            new MenuItem("Ouvrir les journaux", delegate { OpenLogs(); }),
            new MenuItem("-"),
            new MenuItem("Quitter Gros Geek Industrie", delegate { QuitApplication(); }),
        });

        StartServer();
        Application.Run();
    }

    private static string ReadArgument(string[] args, string name)
    {
        for (int index = 0; index < args.Length - 1; index++)
        {
            if (string.Equals(args[index], name, StringComparison.OrdinalIgnoreCase))
            {
                return args[index + 1];
            }
        }
        return string.Empty;
    }

    private static Icon LoadTrayIcon()
    {
        try
        {
            string iconPath = Path.Combine(projectRoot, "assets", "branding", "ggi-publisher-app-icon.png");
            if (File.Exists(iconPath))
            {
                trayBitmap = new Bitmap(iconPath);
                return Icon.FromHandle(trayBitmap.GetHicon());
            }
        }
        catch
        {
        }
        return SystemIcons.Application;
    }

    private static string ReadLocalAppUrl(string root)
    {
        string scheme = "https";
        string port = "8443";
        string envPath = Path.Combine(root, ".env");
        try
        {
            if (File.Exists(envPath))
            {
                foreach (string rawLine in File.ReadAllLines(envPath))
                {
                    string line = rawLine.Trim();
                    if (line.StartsWith("LOCAL_HTTPS_PORT=", StringComparison.OrdinalIgnoreCase))
                    {
                        port = line.Substring(line.IndexOf('=') + 1).Trim();
                    }
                    else if (line.StartsWith("LOCAL_HTTPS_ENABLED=", StringComparison.OrdinalIgnoreCase))
                    {
                        string value = line.Substring(line.IndexOf('=') + 1).Trim().ToLowerInvariant();
                        if (value == "0" || value == "false" || value == "no" || value == "off")
                        {
                            scheme = "http";
                            port = "8080";
                        }
                    }
                }
            }
        }
        catch
        {
        }
        return scheme + "://localhost:" + port;
    }

    private static void StartServer()
    {
        lock (ProcessLock)
        {
            if (shuttingDown || (serverProcess != null && !serverProcess.HasExited))
            {
                return;
            }

            string serverScript = Path.Combine(projectRoot, "server.py");
            if (!File.Exists(serverScript))
            {
                UpdateState("Serveur : server.py introuvable", false);
                ShowBalloon("Démarrage impossible", "Le fichier server.py est introuvable.", ToolTipIcon.Error);
                return;
            }

            try
            {
                ProcessStartInfo startInfo = new ProcessStartInfo
                {
                    FileName = pythonExecutable,
                    Arguments = Quote(serverScript),
                    WorkingDirectory = projectRoot,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                };
                startInfo.EnvironmentVariables["GROS_GEEK_NO_BROWSER"] = "1";
                startInfo.EnvironmentVariables["PYTHONUNBUFFERED"] = "1";

                serverProcess = new Process
                {
                    StartInfo = startInfo,
                    EnableRaisingEvents = true,
                };
                serverProcess.OutputDataReceived += delegate(object sender, DataReceivedEventArgs eventArgs)
                {
                    AppendLog(".server-stdout.log", eventArgs.Data);
                };
                serverProcess.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs eventArgs)
                {
                    AppendLog(".server-stderr.log", eventArgs.Data);
                };
                serverProcess.Exited += ServerExited;

                serverProcess.Start();
                serverProcess.BeginOutputReadLine();
                serverProcess.BeginErrorReadLine();
                UpdateState("Serveur : actif", true);
            }
            catch (Exception error)
            {
                UpdateState("Serveur : erreur de démarrage", false);
                AppendLog(".server-stderr.log", "[Tray] " + error);
                ShowBalloon("Démarrage impossible", error.Message, ToolTipIcon.Error);
            }
        }
    }

    private static void ServerExited(object sender, EventArgs eventArgs)
    {
        if (shuttingDown || restarting)
        {
            return;
        }
        UpdateState("Serveur : arrêté", false);
        ShowBalloon(
            "Serveur Gros Geek arrêté",
            "Le serveur s’est arrêté. Utilise le menu de l’icône pour le redémarrer.",
            ToolTipIcon.Warning
        );
    }

    private static void RestartServer()
    {
        restartItem.Enabled = false;
        UpdateState("Serveur : redémarrage…", false);
        restarting = true;
        try
        {
            StopServer();
            StartServer();
        }
        finally
        {
            restarting = false;
            restartItem.Enabled = true;
        }
    }

    private static void StopServer()
    {
        lock (ProcessLock)
        {
            if (serverProcess == null)
            {
                return;
            }

            try
            {
                if (!serverProcess.HasExited)
                {
                    ProcessStartInfo taskkillInfo = new ProcessStartInfo
                    {
                        FileName = "taskkill.exe",
                        Arguments = "/PID " + serverProcess.Id + " /T /F",
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        WindowStyle = ProcessWindowStyle.Hidden,
                    };
                    using (Process taskkill = Process.Start(taskkillInfo))
                    {
                        taskkill.WaitForExit(10000);
                    }
                    serverProcess.WaitForExit(5000);
                }
            }
            catch (Exception error)
            {
                AppendLog(".server-stderr.log", "[Tray] Arrêt : " + error.Message);
            }
            finally
            {
                serverProcess.Dispose();
                serverProcess = null;
            }
        }
    }

    private static void OpenApplication()
    {
        try
        {
            Process.Start(new ProcessStartInfo(appUrl) { UseShellExecute = true });
        }
        catch (Exception error)
        {
            ShowBalloon("Ouverture impossible", error.Message, ToolTipIcon.Error);
        }
    }

    private static void OpenLogs()
    {
        try
        {
            Process.Start(new ProcessStartInfo("explorer.exe", Quote(projectRoot)) { UseShellExecute = true });
        }
        catch
        {
        }
    }

    private static void QuitApplication()
    {
        shuttingDown = true;
        StopServer();
        trayIcon.Visible = false;
        trayIcon.Dispose();
        if (trayBitmap != null)
        {
            trayBitmap.Dispose();
        }
        Application.Exit();
    }

    private static void UpdateState(string text, bool active)
    {
        if (trayIcon == null || trayIcon.ContextMenu == null)
        {
            return;
        }
        try
        {
            trayIcon.ContextMenu.GetType();
            if (serverStateItem != null)
            {
                serverStateItem.Text = text;
            }
            if (restartItem != null)
            {
                restartItem.Text = active ? "Redémarrer le serveur" : "Démarrer le serveur";
            }
        }
        catch
        {
        }
    }

    private static void ShowBalloon(string title, string text, ToolTipIcon icon)
    {
        if (trayIcon == null)
        {
            return;
        }
        trayIcon.BalloonTipTitle = title;
        trayIcon.BalloonTipText = text;
        trayIcon.BalloonTipIcon = icon;
        trayIcon.ShowBalloonTip(5000);
    }

    private static void AppendLog(string fileName, string line)
    {
        if (line == null)
        {
            return;
        }
        try
        {
            lock (LogLock)
            {
                File.AppendAllText(
                    Path.Combine(projectRoot, fileName),
                    line + Environment.NewLine
                );
            }
        }
        catch
        {
        }
    }

    private static string Quote(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }
}
