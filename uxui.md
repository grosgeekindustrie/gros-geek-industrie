Le plus important maintenant : figer un socle avant de laisser d’autres modifs UI/UX toucher au fichier.

Je te conseille de donner ce cadre simple :

Consignes de base
Ne jamais modifier la logique tags sans demande explicite
Ne pas toucher aux mappings prompts existants
Ne pas renommer les clés agents
Ne pas simplifier un flux multi-agent qui fonctionne
Ne modifier qu’une seule zone à la fois
Toujours travailler sur une branche dédiée
Toujours faire un backup avant remplacement d’un fichier critique
Après chaque modif, vérifier le DOM réel + le comportement réel
Ne pas “deviner” qu’un patch est passé : vérifier dans le fichier
Si une modif touche l’UI, ne pas toucher en même temps au parsing ou au prompt loading
Règle d’or

Quand un système marche partiellement :

on corrige le bug local
on ne refactor pas tout
Pour les prompts multi-agents

Impose ça à ton voisin :

1 agent = 1 rôle
pas de mélange génération / filtre / sélection
pas de persona multiples dans un seul prompt
chaque agent doit pouvoir être debuggué seul
les prompts doivent être courts, hiérarchisés, et sans redondance
Méthode de travail
un test fixe
une seule modif
un seul responsable
un seul verdict
Phrase utile à lui donner telle quelle
Ne casse pas le flux existant. Si tu modifies l’UI, ne touche pas à la logique métier. Si tu modifies la logique métier, ne touche pas au rendu. Toute amélioration doit être locale, vérifiable, et réversible.
Et surtout

Pour titres et description, garde exactement la même philosophie que pour tags :

explore
filter
select

Pas forcément tout de suite, mais oui, c’est clairement une bonne direction.