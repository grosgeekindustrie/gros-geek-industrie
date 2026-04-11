#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(".")
candidates = [
    ROOT / "prompts" / "collection" / "axel-select.md",
    ROOT / "prompts" / "collection" / "axel-select-tags.md",
]

select_prompt = """# AXEL — TAGS SELECT

Tu composes le set final de tags Etsy FR pour la figurine suivante :

- Personnage : [[NOM]]
- Nom court : [[NOM_COURT]]
- Univers : [[UNIVERS]]
- Sculpteur : [[SCULPTEUR]]
- Medium : [[MEDIUM]]
- Échelles : [[ECHELLES]]
- Licence protégée : [[LICENSE]]
- Bibliothèque tags validés / invalidés : [[BIBLIO_TAGS]]

Tu reçois plus bas une liste de CANDIDATS RETENUS.

Mission :
- sélectionner les 13 meilleurs tags
- composer un set équilibré
- naturel
- crédible
- utile SEO
- orienté personnage / univers en priorité

Règles :
- répondre uniquement avec 13 tags
- format numéroté : 1. ... / 2. ...
- 30 caractères max par tag
- pas de doublons directs ou déguisés
- éviter la monotonie des débuts de tags
- hors "cadeau", éviter qu’un même premier mot ouvre plus de 3 tags
- utiliser exactement 2 tags commençant par "cadeau"
- les tags "cadeau" doivent rester naturels et orientés intention d’achat
- au moins 6 tags doivent être clairement ancrés personnage / univers
- si "figurine", "statue", "garage kit" ou "sculpture" est utilisé, il doit ouvrir le tag
- ne jamais utiliser de vocabulaire marketing
- ne jamais inventer un tag hors de la liste fournie

CONSIGNES DE SORTIE STRICTES :
- n’écris aucune phrase d’introduction
- n’écris aucune justification
- n’écris aucune réflexion
- n’écris aucune auto-correction
- n’écris jamais “attendez”, “je corrige”, “voici”, “je vais”, “sélection”
- ne produis qu’une seule liste finale
- ne recommence jamais une seconde liste
- si un tag semble interdit ou faible, remplace-le mentalement avant d’écrire
- la réponse finale doit contenir exactement 13 lignes numérotées, et rien d’autre

FORMAT OBLIGATOIRE :
1. tag
2. tag
3. tag
4. tag
5. tag
6. tag
7. tag
8. tag
9. tag
10. tag
11. tag
12. tag
13. tag
"""

written = []
for path in candidates:
    if path.exists():
        backup = path.with_suffix(path.suffix + ".bak")
        backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
        path.write_text(select_prompt, encoding="utf-8")
        written.append((path, backup))

if not written:
    print("Aucun fichier select trouvé. Fichiers attendus :")
    for c in candidates:
        print(" -", c)
    sys.exit(1)

print("OK: prompt select durci")
for path, backup in written:
    print("Écrit :", path)
    print("Backup:", backup)
