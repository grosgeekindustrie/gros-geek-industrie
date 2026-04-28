'use strict';

(function initPipelineUIFiles(global) {
  global.PipelineUI = global.PipelineUI || {};

  const buildMarkdownPath = (family, mode, fileName) => `${family}/${mode}/${fileName}.md`;

  const readMarkdownFile = async (filePath) => {
    const response = await fetch(`/files/${filePath}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  };

  const writeMarkdownFile = async (filePath, content) => {
    const response = await fetch(`/files/${filePath}`, {
      method: 'PUT',
      body: content,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return content;
  };

  const readLibraryMarkdown = async (mode, key) => readMarkdownFile(
    buildMarkdownPath('biblios', mode, key)
  );

  const writeLibraryMarkdown = async (mode, key, content) => writeMarkdownFile(
    buildMarkdownPath('biblios', mode, key),
    content
  );

  const readPromptMarkdown = async (mode, fileName) => readMarkdownFile(
    buildMarkdownPath('prompts', mode, fileName)
  );

  const writePromptMarkdown = async (mode, fileName, content) => writeMarkdownFile(
    buildMarkdownPath('prompts', mode, fileName),
    content
  );

  global.PipelineUIFiles = {
    buildMarkdownPath,
    readMarkdownFile,
    writeMarkdownFile,
    readLibraryMarkdown,
    writeLibraryMarkdown,
    readPromptMarkdown,
    writePromptMarkdown,
  };

  global.PipelineUI.services = global.PipelineUI.services || {};
  Object.assign(global.PipelineUI.services, {
    files: global.PipelineUIFiles,
  });
})(window);
