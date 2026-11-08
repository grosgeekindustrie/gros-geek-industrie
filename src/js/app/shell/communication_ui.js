(function initPipelineUICommunication(global) {
  'use strict';

  const STORAGE_KEY = 'pipeline.communication.v1';
  const INSTAGRAM_URL = 'https://www.instagram.com/gros.geek.industrie/';
  const DOUBLEX_URL = 'https://doublexindustrie.etsy.com';
  const GROS_GEEK_URL = 'https://grosgeekindustrie.etsy.com';

  const LANGUAGE_ORDER = Object.freeze(['fr', 'en', 'de', 'es', 'it', 'nl', 'pt', 'ja', 'pl', 'ru', 'sv']);
  const TEMPLATES = Object.freeze({
    phone: Object.freeze({
      id: 'phone',
      icon: '📦',
      title: 'C’est parti · téléphone requis',
      meta: 'REMERCIEMENT + EXPÉDITION',
      description: 'Le même message avec la demande de numéro nécessaire à l’étiquette d’expédition.',
      includePhone: true,
    }),
    standard: Object.freeze({
      id: 'standard',
      icon: '✨',
      title: 'C’est parti pour l’atelier',
      meta: 'REMERCIEMENT · GROS GEEK INDUSTRIE',
      description: 'Remercier le client, expliquer la préparation et partager les informations utiles.',
      includePhone: false,
    }),
    shipped: Object.freeze({
      id: 'shipped',
      icon: '🚚',
      title: 'Ton colis est en route',
      meta: 'COMMANDE EXPÉDIÉE',
      description: 'Prévenir le client que sa figurine a quitté l’atelier et rester disponible en cas de question.',
      includePhone: false,
      shortMessage: true,
    }),
  });

  const COPY = Object.freeze({
    fr: {
      label: 'Français', short: 'FR', day: 'Bonjour', evening: 'Bonsoir', friendly: 'Salut',
      shipped: ['J’ai le plaisir de t’informer que ta commande de figurine à peindre et à assembler a été expédiée aujourd’hui.', 'Je te remercie une nouvelle fois pour ta confiance et ton achat. Si tu as la moindre question ou besoin d’assistance, n’hésite pas à me contacter. Je serai ravi de t’aider.'],
      intro: ['Un grand merci pour ta commande et pour ta confiance ! 😊', 'Ta figurine à peindre et à assembler est entre de bonnes mains.', 'Elle sera préparée avec soin à l’atelier avant expédition, avec l’attention nécessaire pour que tu reçoives un kit propre, contrôlé et prêt à peindre.', 'Si tu as la moindre question d’ici là, n’hésite surtout pas à me contacter.'],
      phoneTitle: '📦 Petite précision importante pour l’expédition',
      phone: ['Pourrais-tu me transmettre ton numéro de téléphone ?', 'Il sert uniquement à compléter l’étiquette d’expédition, surtout pour faciliter la livraison à l’international.', 'Il ne sera ni conservé, ni utilisé à d’autres fins, ni transmis à des tiers en dehors du service de livraison.'],
      searchTitle: '🔎 Une recherche particulière ?',
      search: ['Si un jour tu recherches une figurine précise qui n’est pas encore disponible en boutique, tu peux aussi me le demander : je propose de l’impression sur demande. 😁'],
      sisterTitle: '✨ À découvrir aussi',
      sister: ['Tu veux explorer d’autres univers à peindre ? Découvre aussi DOUBLE X Industry : c’est la petite sœur de Gros Geek Industrie.', 'Tu y retrouveras d’autres figurines de collection à peindre, d’autres studios, d’autres styles et d’autres pièces, toujours avec le même soin apporté à l’impression, à la préparation et au contrôle qualité.', 'Tu peux découvrir DOUBLE X Industry ici :', DOUBLEX_URL],
      instagramTitle: '📸 Instagram',
      instagram: ['Tu peux aussi suivre l’atelier sur Instagram :', INSTAGRAM_URL, 'Tu y trouveras notamment :'],
      bullets: ['des concours et codes promo', 'les nouveautés de l’atelier', 'les coulisses des impressions', 'des figurines peintes par les clients', 'des idées pour tes prochains projets peinture'],
      closing: 'À très bientôt,',
    },
    en: {
      label: 'English', short: 'EN', day: 'Hello', evening: 'Good evening', friendly: 'Hi',
      shipped: ['I’m pleased to let you know that your order for a figure to paint and assemble was shipped today.', 'Thank you once again for your trust and your purchase. If you have any questions or need any assistance, please feel free to contact me. I’ll be happy to help.'],
      intro: ['Thank you so much for your order and for your trust! 😊', 'Your figure kit to paint and assemble is in good hands.', 'It will be carefully prepared in the workshop before shipping, with all the attention needed to ensure that you receive a clean, inspected kit that is ready to paint.', 'If you have any questions in the meantime, please feel free to contact me.'],
      phoneTitle: '📦 An important note about shipping',
      phone: ['Could you please send me your phone number?', 'It will only be used to complete the shipping label, especially to make international delivery easier.', 'It will not be stored, used for any other purpose, or shared with anyone outside the delivery service.'],
      searchTitle: '🔎 Looking for something specific?',
      search: ['If you are ever looking for a specific figure that is not yet available in the shop, feel free to ask me: I also offer print-on-demand orders. 😁'],
      sisterTitle: '✨ You may also like',
      sister: ['Want to paint figures from other worlds? Discover DOUBLE X Industry too: it’s the little sister of Gros Geek Industrie.', 'There you will find more collectible figures to paint, other studios, different styles and new pieces, always with the same care given to printing, preparation and quality control.', 'Discover DOUBLE X Industry here:', DOUBLEX_URL],
      instagramTitle: '📸 Instagram',
      instagram: ['You can also follow the workshop on Instagram:', INSTAGRAM_URL, 'There you will find:'],
      bullets: ['giveaways and promo codes', 'the latest workshop releases', 'behind-the-scenes printing content', 'figures painted by customers', 'ideas for your next painting projects'],
      closing: 'See you soon,',
    },
    de: {
      label: 'Deutsch', short: 'DE', day: 'Guten Tag', evening: 'Guten Abend', friendly: 'Hallo',
      shipped: ['Ich freue mich, dir mitteilen zu können, dass deine Bestellung einer Figur zum Bemalen und Zusammenbauen heute versandt wurde.', 'Vielen Dank noch einmal für dein Vertrauen und deinen Einkauf. Wenn du Fragen hast oder Hilfe benötigst, kannst du dich jederzeit gerne bei mir melden. Ich helfe dir gerne weiter.'],
      intro: ['Vielen Dank für deine Bestellung und dein Vertrauen! 😊', 'Dein Figurenbausatz zum Bemalen und Zusammenbauen ist in guten Händen.', 'Vor dem Versand wird er in der Werkstatt sorgfältig vorbereitet und kontrolliert, damit du einen sauberen, geprüften und malfertigen Bausatz erhältst.', 'Wenn du bis dahin Fragen hast, kannst du dich jederzeit gerne bei mir melden.'],
      phoneTitle: '📦 Wichtiger Hinweis zum Versand',
      phone: ['Könntest du mir bitte deine Telefonnummer mitteilen?', 'Sie wird ausschließlich für das Versandetikett benötigt, insbesondere um die internationale Zustellung zu erleichtern.', 'Sie wird weder gespeichert noch anderweitig verwendet oder außerhalb des Versanddienstleisters weitergegeben.'],
      searchTitle: '🔎 Du suchst eine bestimmte Figur?',
      search: ['Wenn du einmal eine bestimmte Figur suchst, die noch nicht im Shop erhältlich ist, kannst du mich gerne fragen: Ich biete auch 3D-Druck auf Anfrage an. 😁'],
      sisterTitle: '✨ Ebenfalls entdecken',
      sister: ['Lust auf neue Welten zum Bemalen? Entdecke auch DOUBLE X Industry: die kleine Schwester von Gros Geek Industrie.', 'Dort findest du weitere Sammlerfiguren zum Bemalen, andere Studios, verschiedene Stile und neue Modelle – mit derselben Sorgfalt bei Druck, Vorbereitung und Qualitätskontrolle.', 'Hier kannst du DOUBLE X Industry entdecken:', DOUBLEX_URL],
      instagramTitle: '📸 Instagram',
      instagram: ['Du kannst der Werkstatt auch auf Instagram folgen:', INSTAGRAM_URL, 'Dort findest du unter anderem:'],
      bullets: ['Gewinnspiele und Rabattcodes', 'Neuheiten aus der Werkstatt', 'Einblicke hinter die Kulissen des Drucks', 'von Kunden bemalte Figuren', 'Ideen für deine nächsten Malprojekte'],
      closing: 'Bis bald,',
    },
    es: {
      label: 'Español', short: 'ES', day: 'Buenos días', evening: 'Buenas tardes', friendly: 'Hola',
      shipped: ['Me alegra informarte de que tu pedido de una figura para pintar y montar ha sido enviado hoy.', 'Muchas gracias de nuevo por tu confianza y por tu compra. Si tienes cualquier pregunta o necesitas ayuda, no dudes en contactar conmigo. Estaré encantado de ayudarte.'],
      intro: ['¡Muchísimas gracias por tu pedido y por tu confianza! 😊', 'Tu figura para pintar y montar está en buenas manos.', 'La prepararé cuidadosamente en el taller antes del envío, prestando toda la atención necesaria para que recibas un kit limpio, revisado y listo para pintar.', 'Si tienes cualquier pregunta mientras tanto, no dudes en escribirme.'],
      phoneTitle: '📦 Una precisión importante sobre el envío',
      phone: ['¿Podrías enviarme tu número de teléfono?', 'Solo se utilizará para completar la etiqueta de envío, especialmente para facilitar la entrega internacional.', 'No se conservará, no se utilizará para ningún otro fin ni se compartirá con terceros ajenos al servicio de entrega.'],
      searchTitle: '🔎 ¿Buscas una figura concreta?',
      search: ['Si algún día buscas una figura que todavía no está disponible en la tienda, también puedes preguntarme: ofrezco impresión bajo pedido. 😁'],
      sisterTitle: '✨ También puedes descubrir',
      sister: ['¿Te apetece explorar otros universos para pintar? Descubre también DOUBLE X Industry: es la hermana pequeña de Gros Geek Industrie.', 'Allí encontrarás otras figuras de colección para pintar, más estudios, estilos diferentes y nuevas piezas, siempre con el mismo cuidado en la impresión, la preparación y el control de calidad.', 'Puedes descubrir DOUBLE X Industry aquí:', DOUBLEX_URL],
      instagramTitle: '📸 Instagram',
      instagram: ['También puedes seguir el taller en Instagram:', INSTAGRAM_URL, 'Allí encontrarás:'],
      bullets: ['sorteos y códigos promocionales', 'las novedades del taller', 'el proceso de impresión entre bastidores', 'figuras pintadas por clientes', 'ideas para tus próximos proyectos de pintura'],
      closing: '¡Hasta muy pronto!',
    },
    it: {
      label: 'Italiano', short: 'IT', day: 'Buongiorno', evening: 'Buonasera', friendly: 'Ciao',
      shipped: ['Sono felice di informarti che il tuo ordine di una miniatura da dipingere e assemblare è stato spedito oggi.', 'Ti ringrazio ancora una volta per la fiducia e per il tuo acquisto. Se hai domande o hai bisogno di assistenza, non esitare a contattarmi. Sarò felice di aiutarti.'],
      intro: ['Grazie di cuore per il tuo ordine e per la fiducia! 😊', 'La tua miniatura da dipingere e assemblare è in buone mani.', 'Prima della spedizione verrà preparata con cura in laboratorio, con tutta l’attenzione necessaria affinché tu riceva un kit pulito, controllato e pronto da dipingere.', 'Se nel frattempo hai qualsiasi domanda, non esitare a contattarmi.'],
      phoneTitle: '📦 Una precisazione importante sulla spedizione',
      phone: ['Potresti inviarmi il tuo numero di telefono?', 'Servirà esclusivamente per completare l’etichetta di spedizione, soprattutto per agevolare la consegna internazionale.', 'Non verrà conservato, utilizzato per altri scopi o comunicato a terzi al di fuori del servizio di consegna.'],
      searchTitle: '🔎 Cerchi qualcosa in particolare?',
      search: ['Se un giorno cerchi una miniatura specifica che non è ancora disponibile nel negozio, puoi chiedermela: offro anche un servizio di stampa su richiesta. 😁'],
      sisterTitle: '✨ Scopri anche',
      sister: ['Ti va di esplorare altri universi da dipingere? Scopri anche DOUBLE X Industry: è la sorella minore di Gros Geek Industrie.', 'Lì troverai altre miniature da collezione da dipingere, altri studi, stili diversi e nuovi modelli, sempre con la stessa cura nella stampa, nella preparazione e nel controllo qualità.', 'Puoi scoprire DOUBLE X Industry qui:', DOUBLEX_URL],
      instagramTitle: '📸 Instagram',
      instagram: ['Puoi seguire il laboratorio anche su Instagram:', INSTAGRAM_URL, 'Troverai in particolare:'],
      bullets: ['concorsi e codici promozionali', 'le novità del laboratorio', 'il dietro le quinte delle stampe', 'miniature dipinte dai clienti', 'idee per i tuoi prossimi progetti di pittura'],
      closing: 'A presto,',
    },
    nl: {
      label: 'Nederlands', short: 'NL', day: 'Goedendag', evening: 'Goedenavond', friendly: 'Hoi',
      shipped: ['Ik laat je graag weten dat je bestelling van een figuur om te schilderen en in elkaar te zetten vandaag is verzonden.', 'Nogmaals hartelijk dank voor je vertrouwen en je aankoop. Heb je een vraag of hulp nodig, neem dan gerust contact met me op. Ik help je graag verder.'],
      intro: ['Hartelijk dank voor je bestelling en je vertrouwen! 😊', 'Je figuur om te schilderen en in elkaar te zetten is in goede handen.', 'Voor verzending wordt de kit zorgvuldig voorbereid en gecontroleerd in het atelier, zodat je een nette, gecontroleerde en schilderklare set ontvangt.', 'Heb je in de tussentijd een vraag, neem dan gerust contact met me op.'],
      phoneTitle: '📦 Een belangrijke opmerking over de verzending',
      phone: ['Zou je mij je telefoonnummer kunnen sturen?', 'Het wordt uitsluitend gebruikt om het verzendlabel in te vullen, vooral om internationale bezorging gemakkelijker te maken.', 'Het wordt niet bewaard, niet voor andere doeleinden gebruikt en niet gedeeld met derden buiten de bezorgdienst.'],
      searchTitle: '🔎 Op zoek naar een specifiek figuur?',
      search: ['Zoek je ooit een bepaald figuur dat nog niet in de winkel staat, vraag het me gerust: ik bied ook 3D-printen op aanvraag aan. 😁'],
      sisterTitle: '✨ Ontdek ook',
      sister: ['Zin om figuren uit andere werelden te schilderen? Ontdek ook DOUBLE X Industry, het kleine zusje van Gros Geek Industrie.', 'Daar vind je andere verzamelfiguren om te schilderen, andere studio’s, verschillende stijlen en nieuwe modellen, altijd met dezelfde zorg voor het printen, de voorbereiding en de kwaliteitscontrole.', 'Ontdek DOUBLE X Industry hier:', DOUBLEX_URL],
      instagramTitle: '📸 Instagram',
      instagram: ['Je kunt het atelier ook volgen op Instagram:', INSTAGRAM_URL, 'Daar vind je onder andere:'],
      bullets: ['winacties en kortingscodes', 'de nieuwste modellen uit het atelier', 'een kijkje achter de schermen bij het printen', 'figuren die door klanten zijn geschilderd', 'ideeën voor je volgende schilderprojecten'],
      closing: 'Tot snel,',
    },
    pt: {
      label: 'Português', short: 'PT', day: 'Olá', evening: 'Boa noite', friendly: 'Olá',
      shipped: ['Tenho o prazer de informar que a tua encomenda de uma figura para pintar e montar foi enviada hoje.', 'Agradeço-te novamente pela confiança e pela compra. Se tiveres alguma dúvida ou precisares de ajuda, não hesites em contactar-me. Terei todo o gosto em ajudar.'],
      intro: ['Muito obrigado pela tua encomenda e pela confiança! 😊', 'A tua figura para pintar e montar está em boas mãos.', 'Antes do envio, será cuidadosamente preparada e verificada no atelier, para que recebas um kit limpo, controlado e pronto a pintar.', 'Se tiveres alguma dúvida entretanto, não hesites em contactar-me.'],
      phoneTitle: '📦 Uma informação importante sobre o envio',
      phone: ['Podes enviar-me o teu número de telefone?', 'Será utilizado apenas para preencher a etiqueta de envio, sobretudo para facilitar a entrega internacional.', 'Não será guardado, utilizado para outros fins nem partilhado com terceiros fora do serviço de entrega.'],
      searchTitle: '🔎 Procuras uma figura específica?',
      search: ['Se um dia procurares uma figura específica que ainda não esteja disponível na loja, também podes perguntar-me: faço impressões por encomenda. 😁'],
      sisterTitle: '✨ Descobre também',
      sister: ['Queres explorar outros universos para pintar? Descobre também a DOUBLE X Industry: é a irmã mais nova da Gros Geek Industrie.', 'Lá encontrarás outras figuras de coleção para pintar, outros estúdios, estilos diferentes e novas peças, sempre com o mesmo cuidado na impressão, preparação e controlo de qualidade.', 'Descobre a DOUBLE X Industry aqui:', DOUBLEX_URL],
      instagramTitle: '📸 Instagram',
      instagram: ['Também podes seguir o atelier no Instagram:', INSTAGRAM_URL, 'Lá encontrarás:'],
      bullets: ['passatempos e códigos promocionais', 'as novidades do atelier', 'os bastidores das impressões', 'figuras pintadas por clientes', 'ideias para os teus próximos projetos de pintura'],
      closing: 'Até breve,',
    },
    ja: {
      label: '日本語', short: 'JA', day: 'こんにちは', evening: 'こんばんは', friendly: 'こんにちは',
      shipped: ['塗装・組み立て用フィギュアのご注文品を本日発送いたしましたので、お知らせいたします。', '改めまして、ご購入と信頼してお任せいただいたことに心より感謝申し上げます。ご質問やお困りのことがございましたら、どうぞお気軽にご連絡ください。喜んでお手伝いいたします。'],
      intro: ['このたびはご注文いただき、そして信頼してお任せいただき、本当にありがとうございます！😊', '塗装・組み立て用のフィギュアは、責任をもってお預かりしています。', 'きれいに整え、検品を行い、すぐに塗装を楽しめるキットとしてお届けできるよう、発送前に工房で丁寧に準備いたします。', 'それまでにご質問がございましたら、どうぞお気軽にご連絡ください。'],
      phoneTitle: '📦 発送に関する大切なお願い',
      phone: ['お電話番号をお知らせいただけますでしょうか？', '海外配送を円滑に行うため、発送ラベルの作成にのみ使用いたします。', '番号を保管したり、他の目的に使用したり、配送業者以外の第三者に提供したりすることはありません。'],
      searchTitle: '🔎 お探しのフィギュアはありますか？',
      search: ['ショップにまだ掲載されていないフィギュアをお探しの場合も、お気軽にご相談ください。ご希望に応じた3Dプリントも承っています。😁'],
      sisterTitle: '✨ こちらもぜひご覧ください',
      sister: ['ほかの世界観のフィギュアも塗ってみませんか？Gros Geek Industrieの妹分、DOUBLE X Industryもぜひご覧ください。', '塗装用のさまざまなコレクションフィギュアや、別のスタジオ、異なるスタイルの作品を、同じ印刷・下処理・品質管理へのこだわりとともにご紹介しています。', 'DOUBLE X Industryはこちら：', DOUBLEX_URL],
      instagramTitle: '📸 Instagram',
      instagram: ['Instagramでも工房の様子をご覧いただけます：', INSTAGRAM_URL, '主な投稿内容：'],
      bullets: ['プレゼント企画や割引コード', '工房の新作情報', '3Dプリントの舞台裏', 'お客様が塗装したフィギュア', '次の塗装プロジェクトのアイデア'],
      closing: 'それでは、また近いうちに。',
    },
    pl: {
      label: 'Polski', short: 'PL', day: 'Dzień dobry', evening: 'Dobry wieczór', friendly: 'Cześć',
      shipped: ['Z przyjemnością informuję, że Twoje zamówienie figurki do malowania i złożenia zostało dziś wysłane.', 'Jeszcze raz dziękuję za zaufanie i zakup. Jeśli masz jakiekolwiek pytania lub potrzebujesz pomocy, napisz do mnie bez wahania. Chętnie pomogę.'],
      intro: ['Bardzo dziękuję za zamówienie i okazane zaufanie! 😊', 'Twoja figurka do malowania i złożenia jest w dobrych rękach.', 'Przed wysyłką zostanie starannie przygotowana i sprawdzona w pracowni, aby dotarł do Ciebie czysty, skontrolowany zestaw gotowy do malowania.', 'Jeśli w międzyczasie pojawią się jakiekolwiek pytania, napisz do mnie bez wahania.'],
      phoneTitle: '📦 Ważna informacja dotycząca wysyłki',
      phone: ['Czy możesz przesłać mi swój numer telefonu?', 'Zostanie użyty wyłącznie do uzupełnienia etykiety wysyłkowej, zwłaszcza w celu ułatwienia dostawy międzynarodowej.', 'Nie będzie przechowywany, wykorzystywany do innych celów ani udostępniany osobom trzecim poza firmą kurierską.'],
      searchTitle: '🔎 Szukasz konkretnej figurki?',
      search: ['Jeśli kiedyś będziesz szukać figurki, której nie ma jeszcze w sklepie, możesz mnie o nią zapytać — oferuję również druk na zamówienie. 😁'],
      sisterTitle: '✨ Warto również zobaczyć',
      sister: ['Masz ochotę malować figurki z innych światów? Zajrzyj też do DOUBLE X Industry — młodszej siostry Gros Geek Industrie.', 'Znajdziesz tam inne figurki kolekcjonerskie do malowania, innych twórców, różne style i kolejne modele — zawsze z taką samą dbałością o druk, przygotowanie i kontrolę jakości.', 'DOUBLE X Industry znajdziesz tutaj:', DOUBLEX_URL],
      instagramTitle: '📸 Instagram',
      instagram: ['Pracownię możesz również obserwować na Instagramie:', INSTAGRAM_URL, 'Znajdziesz tam między innymi:'],
      bullets: ['konkursy i kody rabatowe', 'nowości z pracowni', 'kulisy procesu drukowania', 'figurki pomalowane przez klientów', 'pomysły na kolejne projekty malarskie'],
      closing: 'Do zobaczenia wkrótce,',
    },
    ru: {
      label: 'Русский', short: 'RU', day: 'Добрый день', evening: 'Добрый вечер', friendly: 'Здравствуйте',
      shipped: ['Рад сообщить, что ваш заказ фигурки для покраски и сборки был отправлен сегодня.', 'Ещё раз благодарю вас за доверие и покупку. Если у вас возникнут вопросы или потребуется помощь, обязательно напишите мне. Я с радостью помогу.'],
      intro: ['Большое спасибо за заказ и доверие! 😊', 'Ваша фигурка для покраски и сборки в надёжных руках.', 'Перед отправкой я тщательно подготовлю и проверю её в мастерской, чтобы вы получили чистый, проверенный и готовый к покраске набор.', 'Если до отправки у вас появятся вопросы, обязательно напишите мне.'],
      phoneTitle: '📦 Важное уточнение по поводу доставки',
      phone: ['Пожалуйста, пришлите мне ваш номер телефона.', 'Он будет использован только для заполнения транспортной этикетки, прежде всего чтобы упростить международную доставку.', 'Номер не будет храниться, использоваться для других целей или передаваться третьим лицам, кроме службы доставки.'],
      searchTitle: '🔎 Ищете определённую фигурку?',
      search: ['Если вы когда-нибудь будете искать фигурку, которой ещё нет в магазине, напишите мне: я также выполняю 3D-печать на заказ. 😁'],
      sisterTitle: '✨ Загляните также',
      sister: ['Хотите покрасить фигурки из других вселенных? Загляните и в DOUBLE X Industry — «младшую сестру» Gros Geek Industrie.', 'Там представлены другие коллекционные фигурки для покраски, работы других студий, разные стили и новые модели — с тем же вниманием к печати, подготовке и контролю качества.', 'Открыть DOUBLE X Industry:', DOUBLEX_URL],
      instagramTitle: '📸 Instagram',
      instagram: ['За мастерской также можно следить в Instagram:', INSTAGRAM_URL, 'Там вы найдёте:'],
      bullets: ['розыгрыши и промокоды', 'новинки мастерской', 'закулисье процесса печати', 'фигурки, покрашенные покупателями', 'идеи для следующих проектов по покраске'],
      closing: 'До скорой встречи,',
    },
    sv: {
      label: 'Svenska', short: 'SV', day: 'Hej', evening: 'God kväll', friendly: 'Hej',
      shipped: ['Jag är glad att kunna meddela att din beställning av en figur att måla och montera skickades i dag.', 'Stort tack än en gång för ditt förtroende och ditt köp. Om du har några frågor eller behöver hjälp är du varmt välkommen att kontakta mig. Jag hjälper dig gärna.'],
      intro: ['Stort tack för din beställning och för ditt förtroende! 😊', 'Din figur att måla och montera är i trygga händer.', 'Före leveransen förbereds och kontrolleras den noggrant i verkstaden, så att du får ett rent, kontrollerat kit som är redo att målas.', 'Om du har några frågor under tiden är du varmt välkommen att kontakta mig.'],
      phoneTitle: '📦 Viktig information om leveransen',
      phone: ['Kan du skicka mig ditt telefonnummer?', 'Det används endast för att fylla i fraktetiketten, framför allt för att underlätta internationell leverans.', 'Det sparas inte, används inte för andra ändamål och delas inte med tredje part utanför leveranstjänsten.'],
      searchTitle: '🔎 Letar du efter en särskild figur?',
      search: ['Om du någon gång letar efter en figur som ännu inte finns i butiken får du gärna fråga mig — jag erbjuder även 3D-utskrift på beställning. 😁'],
      sisterTitle: '✨ Upptäck även',
      sister: ['Sugen på att måla figurer från fler världar? Upptäck också DOUBLE X Industry, lillasyster till Gros Geek Industrie.', 'Där hittar du fler samlarfigurer att måla, andra studior, olika stilar och nya modeller, alltid med samma omsorg om utskrift, förberedelse och kvalitetskontroll.', 'Upptäck DOUBLE X Industry här:', DOUBLEX_URL],
      instagramTitle: '📸 Instagram',
      instagram: ['Du kan också följa verkstaden på Instagram:', INSTAGRAM_URL, 'Där hittar du bland annat:'],
      bullets: ['tävlingar och rabattkoder', 'nyheter från verkstaden', 'bakom kulisserna från utskrifterna', 'figurer målade av kunder', 'idéer till dina nästa målningsprojekt'],
      closing: 'Vi hörs snart,',
    },
  });

  const DOUBLEX_SISTER_COPY = Object.freeze({
    fr: ['Tu veux explorer d’autres univers à peindre ? Découvre aussi Gros Geek Industrie, ma boutique principale : c’est la grande sœur de DOUBLE X Industry.', 'Tu y trouveras d’autres figurines de collection à peindre, d’autres studios et d’autres styles, avec le même soin apporté à l’impression, à la préparation et au contrôle qualité.', 'Tu peux découvrir Gros Geek Industrie ici :', GROS_GEEK_URL],
    en: ['Want to paint figures from other worlds? Discover Gros Geek Industrie too: it’s my main shop and the big sister of DOUBLE X Industry.', 'There you will find more collectible figures to paint, from other studios and in different styles, with the same care given to printing, preparation and quality control.', 'Discover Gros Geek Industrie here:', GROS_GEEK_URL],
    de: ['Lust auf neue Welten zum Bemalen? Entdecke auch Gros Geek Industrie: Das ist mein Hauptshop und die große Schwester von DOUBLE X Industry.', 'Dort findest du weitere Sammlerfiguren zum Bemalen, Modelle anderer Studios und verschiedene Stile – mit derselben Sorgfalt bei Druck, Vorbereitung und Qualitätskontrolle.', 'Entdecke Gros Geek Industrie hier:', GROS_GEEK_URL],
    es: ['¿Te apetece explorar otros universos para pintar? Descubre también Gros Geek Industrie, mi tienda principal: es la hermana mayor de DOUBLE X Industry.', 'Allí encontrarás más figuras de colección para pintar, de otros estudios y con estilos diferentes, siempre con el mismo cuidado en la impresión, la preparación y el control de calidad.', 'Descubre Gros Geek Industrie aquí:', GROS_GEEK_URL],
    it: ['Ti va di esplorare altri universi da dipingere? Scopri anche Gros Geek Industrie, il mio negozio principale: è la sorella maggiore di DOUBLE X Industry.', 'Lì troverai altre figure da collezione da dipingere, di altri studi e in stili diversi, sempre con la stessa cura nella stampa, nella preparazione e nel controllo qualità.', 'Scopri Gros Geek Industrie qui:', GROS_GEEK_URL],
    nl: ['Zin om figuren uit andere werelden te schilderen? Ontdek ook Gros Geek Industrie, mijn hoofdwinkel: de grote zus van DOUBLE X Industry.', 'Daar vind je meer verzamelfiguren om te schilderen, van andere studio’s en in verschillende stijlen, met dezelfde zorg voor het printen, de voorbereiding en de kwaliteitscontrole.', 'Ontdek Gros Geek Industrie hier:', GROS_GEEK_URL],
    pt: ['Queres explorar outros universos para pintar? Descobre também a Gros Geek Industrie, a minha loja principal: é a irmã mais velha da DOUBLE X Industry.', 'Lá encontrarás mais figuras de coleção para pintar, de outros estúdios e em estilos diferentes, sempre com o mesmo cuidado na impressão, preparação e controlo de qualidade.', 'Descobre a Gros Geek Industrie aqui:', GROS_GEEK_URL],
    ja: ['ほかの世界観のフィギュアも塗ってみませんか？私のメインショップ、Gros Geek Industrieもぜひご覧ください。DOUBLE X Industryの姉妹店です。', 'ほかのスタジオによる、さまざまなスタイルの塗装用コレクションフィギュアをご覧いただけます。印刷・下処理・品質管理にも同じようにこだわっています。', 'Gros Geek Industrieはこちら：', GROS_GEEK_URL],
    pl: ['Masz ochotę malować figurki z innych światów? Zajrzyj też do Gros Geek Industrie: to mój główny sklep i starsza siostra DOUBLE X Industry.', 'Znajdziesz tam więcej figurek kolekcjonerskich do malowania, od innych twórców i w różnych stylach, przygotowanych z taką samą dbałością o druk i kontrolę jakości.', 'Odkryj Gros Geek Industrie tutaj:', GROS_GEEK_URL],
    ru: ['Хотите покрасить фигурки из других вселенных? Загляните и в Gros Geek Industrie: это мой основной магазин и «старшая сестра» DOUBLE X Industry.', 'Там вы найдёте другие коллекционные фигурки для покраски, работы разных студий и модели в разных стилях — с тем же вниманием к печати, подготовке и контролю качества.', 'Познакомиться с Gros Geek Industrie можно здесь:', GROS_GEEK_URL],
    sv: ['Sugen på att måla figurer från fler världar? Upptäck också Gros Geek Industrie, min huvudbutik och storasyster till DOUBLE X Industry.', 'Där hittar du fler samlarfigurer att måla, från andra studior och i olika stilar, med samma omsorg om utskrift, förberedelse och kvalitetskontroll.', 'Upptäck Gros Geek Industrie här:', GROS_GEEK_URL],
  });

  // Met à jour l'ancienne accroche dans les brouillons déjà copiés ou retouchés,
  // sans toucher au reste du message rédigé par l'utilisateur.
  const PREVIOUS_SISTER_OPENINGS = Object.freeze({
    grosgeek: {
      fr: 'Gros Geek Industrie possède également une boutique sœur : DOUBLE X Industry.',
      en: 'Gros Geek Industrie also has a sister shop: DOUBLE X Industry.',
      de: 'Gros Geek Industrie hat außerdem einen Schwestershop: DOUBLE X Industry.',
      es: 'Gros Geek Industrie también tiene una tienda hermana: DOUBLE X Industry.',
      it: 'Gros Geek Industrie ha anche un negozio gemello: DOUBLE X Industry.',
      nl: 'Gros Geek Industrie heeft ook een zusterwinkel: DOUBLE X Industry.',
      pt: 'A Gros Geek Industrie também tem uma loja irmã: a DOUBLE X Industry.',
      ja: 'Gros Geek Industrieには、姉妹店「DOUBLE X Industry」もあります。',
      pl: 'Gros Geek Industrie ma również sklep siostrzany: DOUBLE X Industry.',
      ru: 'У Gros Geek Industrie есть и сестринский магазин — DOUBLE X Industry.',
      sv: 'Gros Geek Industrie har också en systerbutik: DOUBLE X Industry.',
    },
    doublex: {
      fr: 'DOUBLE X Industry est la boutique sœur de Gros Geek Industrie.',
      en: 'DOUBLE X Industry is the sister shop of Gros Geek Industrie.',
      de: 'DOUBLE X Industry ist der Schwestershop von Gros Geek Industrie.',
      es: 'DOUBLE X Industry es la tienda hermana de Gros Geek Industrie.',
      it: 'DOUBLE X Industry è il negozio gemello di Gros Geek Industrie.',
      nl: 'DOUBLE X Industry is de zusterwinkel van Gros Geek Industrie.',
      pt: 'A DOUBLE X Industry é a loja irmã da Gros Geek Industrie.',
      ja: 'DOUBLE X IndustryはGros Geek Industrieの姉妹店です。',
      pl: 'DOUBLE X Industry jest sklepem siostrzanym Gros Geek Industrie.',
      ru: 'DOUBLE X Industry — сестринский магазин Gros Geek Industrie.',
      sv: 'DOUBLE X Industry är systerbutiken till Gros Geek Industrie.',
    },
  });

  const defaultState = () => ({
    screen: 'index',
    templateId: 'phone',
    language: 'fr',
    customerName: '',
    greetingMode: 'auto',
    greetingModes: { standard: 'auto', phone: 'auto', shipped: 'friendly' },
    includeSister: false,
    drafts: {},
  });

  function readState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const defaults = defaultState();
      return {
        ...defaults,
        ...stored,
        greetingModes: {
          ...defaults.greetingModes,
          ...(stored.greetingModes && typeof stored.greetingModes === 'object' ? stored.greetingModes : {}),
        },
        drafts: stored.drafts && typeof stored.drafts === 'object' ? stored.drafts : {},
      };
    } catch (error) {
      return defaultState();
    }
  }

  let state = readState();
  let bound = false;

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {}
  }

  function escapeHtml(value = '') {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getHost() {
    return document.getElementById('communicationWorkspace');
  }

  function getActiveShopKey() {
    return global.PipelineUIApp?.getActiveShopKey?.() === 'doublex' ? 'doublex' : 'grosgeek';
  }

  function getDraftKey(language = state.language) {
    return `${getActiveShopKey()}:${state.templateId}:${language}`;
  }

  function resolveGreeting(language) {
    const copy = COPY[language];
    const selectedMode = state.greetingModes?.[state.templateId] || state.greetingMode || 'auto';
    const mode = selectedMode === 'auto'
      ? ((new Date().getHours() >= 5 && new Date().getHours() < 18) ? 'day' : 'evening')
      : selectedMode;
    const greeting = mode === 'friendly' ? copy.friendly : (mode === 'evening' ? copy.evening : copy.day);
    const name = String(state.customerName || '').trim();
    if (language === 'ja') return `${name ? `${name}様、` : ''}${greeting}`;
    return `${greeting}${name ? ` ${name}` : ''},`;
  }

  function buildMessage(language) {
    const copy = COPY[language] || COPY.fr;
    const template = TEMPLATES[state.templateId] || TEMPLATES.standard;
    if (template.shortMessage) {
      return [resolveGreeting(language), ...copy.shipped, 'R'].join('\n\n');
    }
    const sections = [
      [resolveGreeting(language), ...copy.intro].join('\n\n'),
    ];

    if (template.includePhone) sections.push([copy.phoneTitle, ...copy.phone].join('\n\n'));
    sections.push([copy.searchTitle, ...copy.search].join('\n\n'));
    if (state.includeSister) {
      const sister = getActiveShopKey() === 'doublex' ? DOUBLEX_SISTER_COPY[language] : copy.sister;
      sections.push([copy.sisterTitle, ...sister].join('\n\n'));
    }
    sections.push([
      copy.instagramTitle,
      ...copy.instagram,
      copy.bullets.map((entry) => `- ${entry}`).join('\n'),
    ].join('\n\n'));
    sections.push([copy.closing, 'R'].join('\n\n'));

    // Trois retours entre les grands blocs pour faciliter le scan visuel.
    return sections.join('\n\n\n');
  }

  function getMessage(language = state.language) {
    const key = getDraftKey(language);
    if (Object.prototype.hasOwnProperty.call(state.drafts, key)) return refreshSisterOpening(key, language);
    const legacyKey = `${state.templateId}:${language}`;
    if (getActiveShopKey() === 'grosgeek' && Object.prototype.hasOwnProperty.call(state.drafts, legacyKey)) {
      return refreshSisterOpening(legacyKey, language);
    }
    return buildMessage(language);
  }

  function refreshSisterOpening(key, language) {
    const message = state.drafts[key];
    const shop = getActiveShopKey();
    const previous = PREVIOUS_SISTER_OPENINGS[shop]?.[language];
    const next = shop === 'doublex' ? DOUBLEX_SISTER_COPY[language]?.[0] : COPY[language]?.sister?.[0];
    if (!previous || !next || !message.includes(previous)) return message;
    state.drafts[key] = message.replace(previous, next);
    persist();
    return state.drafts[key];
  }

  function clearTemplateDrafts() {
    // Le prénom, la salutation et les blocs optionnels sont communs aux deux
    // variantes : une modification invalide donc tous les brouillons dérivés.
    state.drafts = {};
  }

  function renderHero() {
    return `
      <header class="communication-hero">
        <div>
          <span class="communication-kicker">RELATION CLIENT · MODÈLES MULTILINGUES</span>
          <h1 id="communicationTitle">Communication</h1>
          <p>Prépare un message personnalisé, ajuste-le si nécessaire, puis copie-le sans perdre sa mise en page.</p>
        </div>
        <span class="communication-language-count">${getActiveShopKey() === 'doublex' ? 'DOUBLE X INDUSTRY' : 'GROS GEEK INDUSTRIE'} · FR + 10 LOCALISATIONS</span>
      </header>`;
  }

  function renderIndex() {
    const host = getHost();
    if (!host) return;
    host.innerHTML = `<div class="communication-shell">${renderHero()}<section class="communication-template-list" aria-label="Messages disponibles">${Object.values(TEMPLATES).map((template) => `
      <button class="communication-template-card" type="button" data-communication-template="${template.id}">
        <span class="communication-template-icon">${template.icon}</span>
        <span>
          <span class="communication-template-meta">${escapeHtml(template.meta.replace('GROS GEEK INDUSTRIE', getActiveShopKey() === 'doublex' ? 'DOUBLE X INDUSTRY' : 'GROS GEEK INDUSTRIE'))}</span>
          <h2>${escapeHtml(template.title)}</h2>
          <p>${escapeHtml(template.description)}</p>
        </span>
        <span class="communication-template-arrow">→</span>
      </button>`).join('')}</section></div>`;
  }

  function renderEditor() {
    const host = getHost();
    if (!host) return;
    const template = TEMPLATES[state.templateId] || TEMPLATES.standard;
    const language = COPY[state.language] || COPY.fr;
    const selectedGreetingMode = state.greetingModes?.[state.templateId] || 'auto';
    host.innerHTML = `<div class="communication-shell">${renderHero()}
      <section class="communication-editor">
        <aside class="communication-controls">
          <button class="communication-back" type="button" data-communication-back>← Tous les messages</button>
          <div><span class="communication-template-meta">${escapeHtml(template.meta.replace('GROS GEEK INDUSTRIE', getActiveShopKey() === 'doublex' ? 'DOUBLE X INDUSTRY' : 'GROS GEEK INDUSTRIE'))}</span><h2>${escapeHtml(template.title)}</h2></div>
          <label class="communication-field">
            <span class="communication-field-label">PRÉNOM DU CLIENT</span>
            <input type="text" data-communication-name value="${escapeHtml(state.customerName)}" placeholder="Ex. Julie" autocomplete="off">
          </label>
          <fieldset class="communication-field">
            <legend class="communication-field-label">SALUTATION</legend>
            <div class="communication-radio-group">
              ${[['auto', 'Automatique selon l’heure'], ['friendly', 'Salut'], ['day', 'Bonjour'], ['evening', 'Bonsoir']].map(([value, label]) => `<label class="communication-radio"><input type="radio" name="communication-greeting" value="${value}" ${selectedGreetingMode === value ? 'checked' : ''}>${label}</label>`).join('')}
            </div>
          </fieldset>
          ${template.shortMessage ? '' : `<div class="communication-checks"><label class="communication-check"><input type="checkbox" data-communication-sister ${state.includeSister ? 'checked' : ''}>Inclure le bloc « boutique sœur »</label></div>`}
          ${template.shortMessage ? '<p class="communication-fixed-note">Message court : confirmation d’expédition uniquement.</p>' : (template.includePhone ? '<p class="communication-fixed-note">Cette variante inclut la demande de téléphone pour l’étiquette d’expédition.</p>' : '<p class="communication-fixed-note">Cette variante ne demande aucune coordonnée supplémentaire.</p>')}
        </aside>
        <div class="communication-message-panel">
          <nav class="communication-language-tabs" aria-label="Langue du message">${LANGUAGE_ORDER.map((code) => `<button type="button" class="communication-language-tab${state.language === code ? ' is-active' : ''}" data-communication-language="${code}" title="${escapeHtml(COPY[code].label)}">${COPY[code].short}</button>`).join('')}</nav>
          <div class="communication-message-head">
            <div><span class="communication-field-label">MESSAGE · ${escapeHtml(language.short)}</span><h3>${escapeHtml(language.label)}</h3></div>
            <div class="communication-message-actions">
              <button class="communication-action" type="button" data-communication-reset>Régénérer</button>
              <button class="communication-action is-primary" type="button" data-communication-copy><span data-svg-icon="copy"></span><span>Tout copier</span></button>
            </div>
          </div>
          <textarea class="communication-message" data-communication-message spellcheck="true">${escapeHtml(getMessage())}</textarea>
          <p class="communication-copy-status" data-communication-status aria-live="polite"></p>
        </div>
      </section></div>`;
    global.PipelineUIIcons?.hydrateIcons?.(host);
  }

  function render() {
    if (state.screen === 'editor') renderEditor();
    else renderIndex();
  }

  function regenerateControls() {
    clearTemplateDrafts();
    persist();
    const textarea = getHost()?.querySelector('[data-communication-message]');
    if (textarea) textarea.value = buildMessage(state.language);
  }

  async function copyMessage() {
    const textarea = getHost()?.querySelector('[data-communication-message]');
    const status = getHost()?.querySelector('[data-communication-status]');
    if (!textarea) return;
    const text = textarea.value;
    state.drafts[getDraftKey()] = text;
    persist();
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      textarea.setSelectionRange(text.length, text.length);
    }
    if (status) status.textContent = `Message ${COPY[state.language].short} copié avec sa mise en page.`;
    global.showToast?.('Message client copié', '#58d68d');
  }

  function handleClick(event) {
    const templateButton = event.target.closest('[data-communication-template]');
    if (templateButton) {
      state.templateId = templateButton.dataset.communicationTemplate;
      state.screen = 'editor';
      persist();
      renderEditor();
      return;
    }
    if (event.target.closest('[data-communication-back]')) {
      state.screen = 'index';
      persist();
      renderIndex();
      return;
    }
    const languageButton = event.target.closest('[data-communication-language]');
    if (languageButton) {
      state.language = languageButton.dataset.communicationLanguage;
      persist();
      renderEditor();
      return;
    }
    if (event.target.closest('[data-communication-reset]')) {
      delete state.drafts[getDraftKey()];
      if (getActiveShopKey() === 'grosgeek') delete state.drafts[`${state.templateId}:${state.language}`];
      persist();
      const textarea = getHost()?.querySelector('[data-communication-message]');
      if (textarea) textarea.value = buildMessage(state.language);
      return;
    }
    if (event.target.closest('[data-communication-copy]')) copyMessage();
  }

  function handleInput(event) {
    if (event.target.matches('[data-communication-name]')) {
      state.customerName = event.target.value;
      regenerateControls();
      return;
    }
    if (event.target.matches('[data-communication-message]')) {
      state.drafts[getDraftKey()] = event.target.value;
      persist();
    }
  }

  function handleChange(event) {
    if (event.target.matches('input[name="communication-greeting"]')) {
      state.greetingModes = { ...(state.greetingModes || {}), [state.templateId]: event.target.value };
      regenerateControls();
      return;
    }
    if (event.target.matches('[data-communication-sister]')) {
      state.includeSister = event.target.checked;
      regenerateControls();
    }
  }

  function bind() {
    if (bound) return;
    const host = getHost();
    if (!host) return;
    host.addEventListener('click', handleClick);
    host.addEventListener('input', handleInput);
    host.addEventListener('change', handleChange);
    global.addEventListener('pipeline:shop-changed', render);
    bound = true;
  }

  function open() {
    state.screen = 'index';
    state.templateId = 'phone';
    persist();
    bind();
    renderIndex();
  }

  global.PipelineUICommunication = { open, render, buildMessage };
})(window);
