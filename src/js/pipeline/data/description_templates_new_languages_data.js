'use strict';

(function initNewLanguageDescriptionTemplates(global) {
  const templates = global.PipelineUIDataDescriptionTemplates || {};
  const freezeBlocks = (blocks) => Object.freeze(blocks.map((block) => Object.freeze(block.join('\n'))));

  const COLLECTION_IT = freezeBlocks([
    ['🏆 L’esperienza Gros Geek Industrie', '', 'Diverse centinaia di recensioni a 5 stelle testimoniano la qualità e la serietà del nostro laboratorio.', 'Ogni figura viene preparata, pulita e montata a secco per garantire un assemblaggio pulito, semplice e piacevole.', 'Gli elementi sottili o fragili possono essere forniti in doppio quando necessario, per un’esperienza più serena e perfettamente adatta agli appassionati di pittura.'],
    ['ℹ️ Modello non dipinto, garage kit da assemblare', '', '✔️ Le nostre figure vengono fornite come garage kit da assemblare e dipingere.', '🎨 Le immagini a colori sono rendering 3D presentati a scopo illustrativo.', '🖌️ Esprimi la tua creatività e dai vita al modello con la tua tavolozza di colori.'],
    ['🎨 Resina 14K HD, dettagli nitidi e struttura affidabile', '', 'Ogni modello è stampato in resina 14K ad alta definizione per riprodurre le texture più fini, le incisioni e le espressioni.', 'La nostra miscela esclusiva di resina 14K rinforzata migliora la solidità e offre una leggera flessibilità agli elementi sottili, per un equilibrio ideale tra precisione e durata.'],
    ['🖌️ Una resina pensata per la pittura', '', 'Resina fotopolimerica premium, perfettamente compatibile con i colori acrilici.', 'Superficie pulita e liscia per un’ottima adesione di primer, lavature, velature e sfumature.', 'Ogni kit è progettato per offrire un’esperienza di pittura fluida e piacevole, qualunque sia il tuo livello.'],
    ['✅ Controllo qualità rigoroso', '', 'Ogni stampa viene ispezionata pezzo per pezzo prima della spedizione.', 'Nessuna figura lascia il laboratorio senza rispettare i nostri standard di finitura:', 'nessuna bolla, nessuna deformazione e incastri verificati a secco.'],
    ['⚙️ Preparato, pulito, pronto da dipingere', '', '• Supporti rimossi con cura', '• Pulizia completa e post-cura UV', '• Prima del primer può essere necessaria soltanto una leggera carteggiatura superficiale', '🧼 Niente più lunghe ore di preparazione: puoi passare rapidamente alla pittura.'],
    ['🧩 Assemblaggio semplice e intuitivo', '', 'I punti di connessione sono progettati per allinearsi naturalmente.', 'A seconda del kit può essere necessario un leggero adattamento.', '💡 Colla consigliata: super glue, cianoacrilato.'],
    ['🎭 Pose espressive ed equilibrate', '', 'Ogni scultura viene selezionata per il suo impatto visivo:', 'posa controllata, linee leggibili ed espressività pensata per valorizzare una vetrina o un diorama.'],
    ['📏 Scale disponibili', '', 'I nostri modelli sono disponibili in diversi formati standard, come 1/6, 1/8 e 1/10, per adattarsi a ogni spazio espositivo: vetrine, diorami o giochi di miniature.', '🛠️ Hai bisogno di una scala personalizzata? Contattami.'],
    ['🎁 Un progetto personale o un regalo unico', '', 'Ideale per hobbisti, pittori e collezionisti.', 'Da regalare o assemblare personalmente per arricchire la tua collezione e la tua esperienza di pittura.'],
    ['♻️ Fan Art, rispetto e sostegno agli artisti indipendenti', '', 'I nostri modelli sono creazioni Fan Art non ufficiali, realizzate da scultori indipendenti.', 'Sosteniamo il loro lavoro tramite piattaforme come Patreon e MyMiniFactory, contribuendo così alla creazione originale.'],
    ['💰 Un’alternativa artigianale e di qualità', '', 'Alcune figure ufficiali sono rare o molto costose.', 'Proponiamo modelli ispirati e accessibili, prodotti in Francia secondo standard di finitura degni di un pezzo professionale.'],
    ['📩 Servizio clienti reattivo', '', 'Hai una domanda o una richiesta di personalizzazione?', '📬 Contattami direttamente su Etsy: risposta rapida garantita prima o dopo il tuo ordine.'],
    ['⚖️ Uso e sicurezza', '', '• Prodotto destinato a collezionisti e modellisti', '• Non adatto a bambini di età inferiore ai 14 anni', '• Resine conformi alle normative RoHS e REACH', '• Produzione additiva conforme alla norma ISO/ASTM 52900'],
  ]);

  const TABLETOP_IT = freezeBlocks([
    ['🏆 L’esperienza Gros Geek Industrie', '', 'Diverse centinaia di recensioni a 5 stelle testimoniano la qualità e la serietà del nostro laboratorio.', 'Ogni miniatura viene preparata, pulita e provata a secco quando necessario per garantire un assemblaggio pulito e piacevole.', 'Gli elementi sottili o fragili vengono forniti in doppio quando utile, per un’esperienza più serena e perfettamente adatta agli appassionati di pittura.'],
    ['ℹ️ Modello da dipingere. Garage kit da assemblare', '', '✔️ Le nostre miniature vengono fornite come garage kit da assemblare e dipingere.', '🎨 Le immagini a colori sono rendering 3D presentati a scopo illustrativo.', '🖌️ Esprimi la tua creatività e dai vita al modello con la tua tavolozza di colori.'],
    ['✅ Controllo qualità rigoroso', '', 'Ogni stampa viene ispezionata pezzo per pezzo prima della spedizione.', 'Nessuna miniatura lascia il laboratorio senza rispettare i nostri standard di finitura: stampa pulita, dettagli nitidi, pezzi controllati e incastri provati a secco quando necessario.'],
    ['⚙️ Preparata, pulita, pronta da dipingere', '', '• Supporti rimossi con cura', '• Pulizia completa e post-cura UV', '• Pezzi controllati prima della spedizione', '• Prima del primer è sufficiente una leggera carteggiatura superficiale', '🧼 Niente più lunghe fasi di preparazione: puoi passare direttamente al piacere della pittura.'],
    ['🎲 Pensata per il tavolo da gioco', '', 'Una miniatura tabletop non deve soltanto essere bella in foto. Deve anche poter essere maneggiata, trasportata e utilizzata partita dopo partita.', 'Ogni pezzo è progettato per accompagnare a lungo le tue campagne, i tuoi eserciti e le tue sessioni di gioco.'],
    ['🎁 Un progetto personale o un regalo unico', '', 'Ideale per hobbisti, pittori, giocatori di ruolo, wargamer e collezionisti.', 'Da regalare o assemblare personalmente per arricchire la tua collezione, preparare un personaggio per una campagna o aggiungere un pezzo speciale al tuo esercito.'],
    ['📩 Servizio clienti reattivo', '', 'Hai una domanda o una richiesta di personalizzazione?', '📬 Scrivici direttamente su Etsy: risposta rapida garantita prima o dopo il tuo ordine.'],
    ['⚖️ Uso e sicurezza', '', '• Prodotto destinato a collezionisti e modellisti', '• Non adatto a bambini di età inferiore ai 14 anni', '• Resine conformi alle normative RoHS e REACH', '• Produzione additiva conforme alla norma ISO/ASTM 52900'],
  ]);

  const RECEIPT_COLLECTION_IT = freezeBlocks([['✅ Cosa ricevi:', '• Una figura fisica in resina non dipinta da dipingere (garage kit)', '• Kit non dipinto: le immagini a colori sono rendering 3D presentati a scopo illustrativo', '• Pulita e preparata: pronta per primer e pittura', '• Imballaggio sicuro e protezione degli elementi sottili', '• Scala: da 1/10 a 1/6 (dimensioni riportate sotto)']]);
  const RECEIPT_TABLETOP_IT = freezeBlocks([['✅ Da leggere prima. Cosa ricevi', '', '• Una miniatura fisica in resina non dipinta da dipingere (garage kit)', '• Kit non dipinto: le immagini a colori sono rendering 3D presentati a scopo illustrativo', '• Pulita e preparata: pronta per primer e pittura', '• Imballaggio sicuro e protezione degli elementi sottili']]);
  const TABLETOP_RESIN_IT = freezeBlocks([['🛡️ La Rolls-Royce delle resine tabletop', '', 'Per le nostre miniature da gioco da 32 a 54 mm utilizziamo la TGM7 di Ameralabs:', '', '• Resina premium di fascia alta', '• Dettagli nitidi dopo la stampa', '• Eccellente resistenza agli urti', '• Trasporto più sicuro tra una partita e l’altra', '• Progettata per accompagnare i tuoi eserciti per anni']]);
  const DOUBLEX_EXPERIENCE_IT = freezeBlocks([['🏆 L’esperienza Double X Industrie', '', 'Double X Industrie riprende il know-how di laboratorio sviluppato con Gros Geek Industrie, con la stessa cura dedicata alla stampa, alla pulizia e alla preparazione delle figure.', 'Ogni pezzo viene preparato, controllato e provato a secco quando necessario, per offrire un assemblaggio pulito e piacevole.', 'Gli elementi sottili o fragili vengono forniti in doppio quando utile, per un’esperienza più serena e adatta agli appassionati di pittura.']]);

  const COLLECTION_NL = freezeBlocks([
    ['🏆 De Gros Geek Industrie ervaring', '', 'Enkele honderden vijfsterrenbeoordelingen getuigen van de kwaliteit en betrouwbaarheid van ons atelier.', 'Elk figuur wordt voorbereid, gereinigd en droog gepast om een nette, soepele en aangename montage te garanderen.', 'Dunne of breekbare onderdelen kunnen waar nodig dubbel worden meegeleverd, voor meer gemoedsrust en een ervaring die perfect past bij enthousiaste schilders.'],
    ['ℹ️ Ongeverfd model, garage kit om zelf te monteren', '', '✔️ Onze figuren worden geleverd als garage kits die je zelf monteert en schildert.', '🎨 De gekleurde afbeeldingen zijn 3D-renders en dienen ter inspiratie.', '🖌️ Laat je creativiteit de vrije loop en breng je model tot leven met je eigen kleurenpalet.'],
    ['🎨 14K HD-hars, scherpe details en een betrouwbare structuur', '', 'Elk model wordt geprint in 14K-hars met hoge resolutie om de fijnste texturen, gravures en gezichtsuitdrukkingen weer te geven.', 'Onze exclusieve mix van versterkte 14K-hars verhoogt de stevigheid en geeft dunne onderdelen een lichte flexibiliteit, voor een ideale balans tussen precisie en duurzaamheid.'],
    ['🖌️ Hars ontwikkeld voor schilderwerk', '', 'Premium fotopolymeerhars, perfect geschikt voor acrylverf.', 'Een schoon en glad oppervlak voor uitstekende hechting van primer, washes, glazes en kleurverlopen.', 'Elke kit is ontworpen voor een soepele en aangename schilderervaring, ongeacht je niveau.'],
    ['✅ Strenge kwaliteitscontrole', '', 'Elke print wordt vóór verzending onderdeel voor onderdeel gecontroleerd.', 'Geen enkel figuur verlaat het atelier zonder aan onze afwerkingsnormen te voldoen:', 'geen luchtbellen, geen vervorming en droog geteste pasvormen.'],
    ['⚙️ Voorbereid, gereinigd en klaar om te schilderen', '', '• Steunen zorgvuldig verwijderd', '• Volledige reiniging en UV-nabehandeling', '• Vóór de primer kan alleen licht opschuren van het oppervlak nodig zijn', '🧼 Geen urenlange voorbereiding meer: je kunt snel beginnen met schilderen.'],
    ['🧩 Eenvoudige en intuïtieve montage', '', 'De verbindingspunten zijn ontworpen om vanzelf goed uit te lijnen.', 'Afhankelijk van de kit kan een kleine aanpassing nodig zijn.', '💡 Aanbevolen lijm: secondelijm, cyanoacrylaat.'],
    ['🎭 Expressieve en evenwichtige poses', '', 'Elke sculptuur wordt geselecteerd op visuele impact:', 'een beheerste houding, duidelijke lijnen en expressiviteit die een vitrinekast of diorama extra uitstraling geven.'],
    ['📏 Beschikbare schalen', '', 'Onze modellen zijn verkrijgbaar in verschillende standaardschalen, zoals 1/6, 1/8 en 1/10, zodat ze passen in elke presentatieruimte: vitrinekasten, diorama’s of miniatuurspellen.', '🛠️ Een aangepaste schaal nodig? Neem gerust contact met me op.'],
    ['🎁 Een persoonlijk project of een uniek cadeau', '', 'Ideaal voor hobbyisten, schilders en verzamelaars.', 'Om cadeau te geven of zelf te bouwen en zo je collectie en schilderervaring uit te breiden.'],
    ['♻️ Fan Art, respect en steun voor onafhankelijke kunstenaars', '', 'Onze modellen zijn onofficiële Fan Art-creaties van onafhankelijke beeldhouwers.', 'Wij ondersteunen hun werk via platforms zoals Patreon en MyMiniFactory en dragen zo bij aan originele creaties.'],
    ['💰 Een ambachtelijk en kwalitatief alternatief', '', 'Sommige officiële figuren zijn zeldzaam of erg duur.', 'Wij bieden geïnspireerde en betaalbare modellen, geproduceerd in Frankrijk volgens afwerkingsnormen die passen bij een professioneel kwaliteitsstuk.'],
    ['📩 Snelle klantenservice', '', 'Heb je een vraag of een verzoek voor personalisatie?', '📬 Neem rechtstreeks contact met me op via Etsy: een snel antwoord gegarandeerd, vóór of na je bestelling.'],
    ['⚖️ Gebruik en veiligheid', '', '• Product bestemd voor verzamelaars en modelbouwers', '• Niet geschikt voor kinderen jonger dan 14 jaar', '• Harsen voldoen aan RoHS en REACH', '• Additieve productie volgens de norm ISO/ASTM 52900'],
  ]);

  const TABLETOP_NL = freezeBlocks([
    ['🏆 De Gros Geek Industrie ervaring', '', 'Enkele honderden vijfsterrenbeoordelingen getuigen van de kwaliteit en betrouwbaarheid van ons atelier.', 'Elke miniatuur wordt voorbereid, gereinigd en waar nodig droog gepast om een nette en aangename montage te garanderen.', 'Dunne of breekbare onderdelen worden waar nuttig dubbel meegeleverd, voor meer gemoedsrust en een ervaring die perfect past bij enthousiaste schilders.'],
    ['ℹ️ Model om te schilderen. Garage kit om zelf te monteren', '', '✔️ Onze miniaturen worden geleverd als garage kits die je zelf monteert en schildert.', '🎨 De gekleurde afbeeldingen zijn 3D-renders en dienen ter inspiratie.', '🖌️ Laat je creativiteit de vrije loop en breng je model tot leven met je eigen kleurenpalet.'],
    ['✅ Strenge kwaliteitscontrole', '', 'Elke print wordt vóór verzending onderdeel voor onderdeel gecontroleerd.', 'Geen enkele miniatuur verlaat het atelier zonder aan onze afwerkingsnormen te voldoen: een schone print, duidelijke details, gecontroleerde onderdelen en waar nodig droog geteste pasvormen.'],
    ['⚙️ Voorbereid, gereinigd en klaar om te schilderen', '', '• Steunen zorgvuldig verwijderd', '• Volledige reiniging en UV-nabehandeling', '• Onderdelen vóór verzending gecontroleerd', '• Licht opschuren van het oppervlak volstaat vóór de primer', '🧼 Geen lange voorbereiding meer: je kunt meteen genieten van het schilderen.'],
    ['🎲 Ontworpen voor de speeltafel', '', 'Een tabletopminiatuur moet er niet alleen mooi uitzien op foto’s. Ze moet ook hanteerbaar en vervoerbaar zijn en spel na spel opnieuw kunnen worden ingezet.', 'Elk onderdeel is ontworpen om je campagnes, legers en speelsessies jarenlang te begeleiden.'],
    ['🎁 Een persoonlijk project of een uniek cadeau', '', 'Ideaal voor hobbyisten, schilders, rollenspelers, wargamers en verzamelaars.', 'Om cadeau te geven of zelf te bouwen, je collectie uit te breiden, een campagnepersonage voor te bereiden of een opvallend model aan je leger toe te voegen.'],
    ['📩 Snelle klantenservice', '', 'Heb je een vraag of een verzoek voor personalisatie?', '📬 Schrijf ons rechtstreeks via Etsy: een snel antwoord gegarandeerd, vóór of na je bestelling.'],
    ['⚖️ Gebruik en veiligheid', '', '• Product bestemd voor verzamelaars en modelbouwers', '• Niet geschikt voor kinderen jonger dan 14 jaar', '• Harsen voldoen aan RoHS en REACH', '• Additieve productie volgens de norm ISO/ASTM 52900'],
  ]);

  const RECEIPT_COLLECTION_NL = freezeBlocks([['✅ Wat je ontvangt:', '• Een fysiek, ongeverfd harsfiguur om zelf te schilderen (garage kit)', '• Ongeverfde kit: de gekleurde afbeeldingen zijn 3D-renders en dienen ter inspiratie', '• Gereinigd en voorbereid: klaar voor primer en verf', '• Veilige verpakking en bescherming van dunne onderdelen', '• Schaal: van 1/10 tot 1/6 (afmetingen hieronder)']]);
  const RECEIPT_TABLETOP_NL = freezeBlocks([['✅ Eerst lezen. Wat je ontvangt', '', '• Een fysieke, ongeverfde harsminiatuur om zelf te schilderen (garage kit)', '• Ongeverfde kit: de gekleurde afbeeldingen zijn 3D-renders en dienen ter inspiratie', '• Gereinigd en voorbereid: klaar voor primer en verf', '• Veilige verpakking en bescherming van dunne onderdelen']]);
  const TABLETOP_RESIN_NL = freezeBlocks([['🛡️ De Rolls-Royce onder de tabletopharsen', '', 'Voor onze speelminiaturen van 32 tot 54 mm gebruiken we Ameralabs TGM7:', '', '• Hoogwaardige premiumhars', '• Scherpe details na het printen', '• Uitstekende slagvastheid', '• Zorgeloos vervoer tussen twee spellen', '• Ontworpen om je legers jarenlang te volgen']]);
  const DOUBLEX_EXPERIENCE_NL = freezeBlocks([['🏆 De Double X Industrie ervaring', '', 'Double X Industrie bouwt voort op de atelierkennis die samen met Gros Geek Industrie is ontwikkeld, met dezelfde zorg voor het printen, reinigen en voorbereiden van de figuren.', 'Elk onderdeel wordt voorbereid, gecontroleerd en waar nodig droog gepast voor een nette en aangename montage.', 'Dunne of breekbare onderdelen worden waar nuttig dubbel meegeleverd, voor meer gemoedsrust en een ervaring die past bij enthousiaste schilders.']]);

  const COLLECTION_PT = freezeBlocks([
    ['🏆 A experiência Gros Geek Industrie', '', 'Várias centenas de avaliações de 5 estrelas comprovam a qualidade e o rigor do nosso atelier.', 'Cada figura é preparada, limpa e montada a seco para garantir uma montagem limpa, simples e agradável.', 'As peças finas ou frágeis podem ser fornecidas em duplicado quando necessário, para uma experiência mais tranquila e perfeitamente adaptada aos apaixonados por pintura.'],
    ['ℹ️ Modelo não pintado, garage kit para montar', '', '✔️ As nossas figuras são fornecidas como garage kits para montares e pintares.', '🎨 As imagens a cores são renderizações 3D apresentadas como inspiração.', '🖌️ Dá asas à tua criatividade e dá vida à peça com a tua própria paleta de cores.'],
    ['🎨 Resina 14K HD, detalhes nítidos e estrutura fiável', '', 'Cada modelo é impresso em resina 14K de alta definição para reproduzir as texturas mais finas, as gravações e as expressões.', 'A nossa mistura exclusiva de resina 14K reforçada melhora a resistência e oferece uma ligeira flexibilidade às peças finas, para um equilíbrio ideal entre precisão e durabilidade.'],
    ['🖌️ Uma resina concebida para pintura', '', 'Resina fotopolimérica premium, perfeitamente compatível com tintas acrílicas.', 'Superfície limpa e lisa para uma excelente aderência de primários, lavagens, velaturas e degradês.', 'Cada kit é concebido para proporcionar uma experiência de pintura fluida e agradável, seja qual for o teu nível.'],
    ['✅ Controlo de qualidade rigoroso', '', 'Cada impressão é inspecionada peça a peça antes do envio.', 'Nenhuma figura sai do atelier sem cumprir os nossos padrões de acabamento:', 'sem bolhas, sem deformações e encaixes testados a seco.'],
    ['⚙️ Preparado, limpo e pronto para pintar', '', '• Suportes removidos cuidadosamente', '• Limpeza completa e pós-cura UV', '• Antes do primário, poderá ser necessário apenas um ligeiro lixamento da superfície', '🧼 Acabaram-se as longas horas de preparação: podes começar rapidamente a pintar.'],
    ['🧩 Montagem simples e intuitiva', '', 'Os pontos de ligação são concebidos para se alinharem naturalmente.', 'Poderá ser necessário um pequeno ajuste, consoante o kit.', '💡 Cola recomendada: supercola, cianoacrilato.'],
    ['🎭 Poses expressivas e equilibradas', '', 'Cada escultura é selecionada pelo seu impacto visual:', 'postura controlada, linhas legíveis e expressividade pensada para valorizar uma vitrina ou um diorama.'],
    ['📏 Escalas disponíveis', '', 'Os nossos modelos estão disponíveis em vários formatos padrão, como 1/6, 1/8 e 1/10, para se adaptarem a todos os espaços de exposição: vitrinas, dioramas ou jogos de miniaturas.', '🛠️ Precisas de uma escala personalizada? Contacta-me.'],
    ['🎁 Um projeto pessoal ou um presente único', '', 'Ideal para entusiastas, pintores e colecionadores.', 'Para oferecer ou montar pessoalmente, enriquecendo a tua coleção e a tua experiência de pintura.'],
    ['♻️ Fan Art, respeito e apoio aos artistas independentes', '', 'Os nossos modelos são criações Fan Art não oficiais, realizadas por escultores independentes.', 'Apoiamos o seu trabalho através de plataformas como Patreon e MyMiniFactory, contribuindo assim para a criação original.'],
    ['💰 Uma alternativa artesanal e de qualidade', '', 'Algumas figuras oficiais são raras ou muito dispendiosas.', 'Propomos modelos inspirados e acessíveis, produzidos em França segundo padrões de acabamento dignos de uma peça de qualidade profissional.'],
    ['📩 Apoio ao cliente rápido', '', 'Tens alguma pergunta ou pedido de personalização?', '📬 Contacta-me diretamente no Etsy: resposta rápida garantida antes ou depois da tua encomenda.'],
    ['⚖️ Utilização e segurança', '', '• Produto destinado a colecionadores e modelistas', '• Não adequado para crianças com menos de 14 anos', '• Resinas em conformidade com RoHS e REACH', '• Fabrico aditivo segundo a norma ISO/ASTM 52900'],
  ]);

  const TABLETOP_PT = freezeBlocks([
    ['🏆 A experiência Gros Geek Industrie', '', 'Várias centenas de avaliações de 5 estrelas comprovam a qualidade e o rigor do nosso atelier.', 'Cada miniatura é preparada, limpa e testada a seco quando necessário para garantir uma montagem limpa e agradável.', 'As peças finas ou frágeis são fornecidas em duplicado quando útil, para uma experiência mais tranquila e perfeitamente adaptada aos apaixonados por pintura.'],
    ['ℹ️ Modelo para pintar. Garage kit para montar', '', '✔️ As nossas miniaturas são fornecidas como garage kits para montares e pintares.', '🎨 As imagens a cores são renderizações 3D apresentadas como inspiração.', '🖌️ Dá asas à tua criatividade e dá vida à peça com a tua própria paleta de cores.'],
    ['✅ Controlo de qualidade exigente', '', 'Cada impressão é inspecionada peça a peça antes do envio.', 'Nenhuma miniatura sai do atelier sem cumprir os nossos padrões de acabamento: impressão limpa, detalhes nítidos, peças verificadas e encaixes testados a seco quando necessário.'],
    ['⚙️ Preparada, limpa e pronta para pintar', '', '• Suportes removidos cuidadosamente', '• Limpeza completa e pós-cura UV', '• Peças verificadas antes do envio', '• Um ligeiro lixamento da superfície é suficiente antes do primário', '🧼 Acabaram-se as longas etapas de preparação: podes passar diretamente ao prazer da pintura.'],
    ['🎲 Concebida para a mesa de jogo', '', 'Uma miniatura tabletop não deve ser apenas bonita nas fotografias. Também deve poder ser manuseada, transportada e utilizada jogo após jogo.', 'Cada peça é concebida para acompanhar as tuas campanhas, os teus exércitos e as tuas sessões de jogo durante muito tempo.'],
    ['🎁 Um projeto pessoal ou um presente único', '', 'Ideal para entusiastas, pintores, jogadores de RPG, wargamers e colecionadores.', 'Para oferecer ou montar pessoalmente, enriquecer a tua coleção, preparar uma personagem de campanha ou acrescentar uma peça marcante ao teu exército.'],
    ['📩 Apoio ao cliente rápido', '', 'Tens alguma pergunta ou pedido de personalização?', '📬 Escreve-nos diretamente no Etsy: resposta rápida garantida antes ou depois da tua encomenda.'],
    ['⚖️ Utilização e segurança', '', '• Produto destinado a colecionadores e modelistas', '• Não adequado para crianças com menos de 14 anos', '• Resinas em conformidade com RoHS e REACH', '• Fabrico aditivo segundo a norma ISO/ASTM 52900'],
  ]);

  const RECEIPT_COLLECTION_PT = freezeBlocks([['✅ O que recebes:', '• Uma figura física em resina não pintada para pintar (garage kit)', '• Kit não pintado: as imagens a cores são renderizações 3D apresentadas como inspiração', '• Limpa e preparada: pronta para primário e pintura', '• Embalagem segura e proteção das peças finas', '• Escala: de 1/10 a 1/6 (dimensões abaixo)']]);
  const RECEIPT_TABLETOP_PT = freezeBlocks([['✅ Lê primeiro. O que recebes', '', '• Uma miniatura física em resina não pintada para pintar (garage kit)', '• Kit não pintado: as imagens a cores são renderizações 3D apresentadas como inspiração', '• Limpa e preparada: pronta para primário e pintura', '• Embalagem segura e proteção das peças finas']]);
  const TABLETOP_RESIN_PT = freezeBlocks([['🛡️ O Rolls-Royce das resinas tabletop', '', 'Para as nossas miniaturas de jogo de 32 a 54 mm, utilizamos a TGM7 da Ameralabs:', '', '• Resina premium de alta qualidade', '• Detalhes nítidos após a impressão', '• Excelente resistência aos impactos', '• Transporte mais tranquilo entre jogos', '• Concebida para acompanhar os teus exércitos durante anos']]);
  const DOUBLEX_EXPERIENCE_PT = freezeBlocks([['🏆 A experiência Double X Industrie', '', 'A Double X Industrie dá continuidade ao saber-fazer de atelier desenvolvido com a Gros Geek Industrie, com o mesmo cuidado na impressão, limpeza e preparação das figuras.', 'Cada peça é preparada, verificada e testada a seco quando necessário, para proporcionar uma montagem limpa e agradável.', 'Os elementos finos ou frágeis são fornecidos em duplicado quando útil, para uma experiência mais tranquila e adaptada aos apaixonados por pintura.']]);

  const introBase = templates.INTRO_FIXED_BLOCKS_BY_FAMILY_AND_LANGUAGE || {};
  const fixedBase = templates.FIXED_BLOCKS_BY_FAMILY_AND_LANGUAGE || {};
  const addLanguages = (familyMap, additionsByFamily) => Object.freeze(Object.fromEntries(
    Object.entries(familyMap).map(([family, languages]) => [
      family,
      Object.freeze({ ...languages, ...(additionsByFamily[family] || {}) }),
    ]),
  ));

  templates.INTRO_FIXED_BLOCKS_BY_FAMILY_AND_LANGUAGE = addLanguages(introBase, {
    collection: { it: [], nl: [], pt: [] },
    collection_doublex: { it: RECEIPT_COLLECTION_IT, nl: RECEIPT_COLLECTION_NL, pt: RECEIPT_COLLECTION_PT },
    tabletop: { it: TABLETOP_RESIN_IT, nl: TABLETOP_RESIN_NL, pt: TABLETOP_RESIN_PT },
    tabletop_doublex: {
      it: Object.freeze([...RECEIPT_TABLETOP_IT, ...TABLETOP_RESIN_IT]),
      nl: Object.freeze([...RECEIPT_TABLETOP_NL, ...TABLETOP_RESIN_NL]),
      pt: Object.freeze([...RECEIPT_TABLETOP_PT, ...TABLETOP_RESIN_PT]),
    },
  });

  templates.FIXED_BLOCKS_BY_FAMILY_AND_LANGUAGE = addLanguages(fixedBase, {
    collection: { it: COLLECTION_IT, nl: COLLECTION_NL, pt: COLLECTION_PT },
    collection_doublex: {
      it: Object.freeze([...DOUBLEX_EXPERIENCE_IT, ...COLLECTION_IT.slice(1)]),
      nl: Object.freeze([...DOUBLEX_EXPERIENCE_NL, ...COLLECTION_NL.slice(1)]),
      pt: Object.freeze([...DOUBLEX_EXPERIENCE_PT, ...COLLECTION_PT.slice(1)]),
    },
    tabletop: { it: TABLETOP_IT, nl: TABLETOP_NL, pt: TABLETOP_PT },
    tabletop_doublex: {
      it: Object.freeze([...DOUBLEX_EXPERIENCE_IT, ...TABLETOP_IT.slice(1)]),
      nl: Object.freeze([...DOUBLEX_EXPERIENCE_NL, ...TABLETOP_NL.slice(1)]),
      pt: Object.freeze([...DOUBLEX_EXPERIENCE_PT, ...TABLETOP_PT.slice(1)]),
    },
  });
})(window);
