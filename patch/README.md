# Patches

Organisation recommandée :

- `patch/py/` → scripts Python de migration / refactor / réparation
- `patch/git/` → vrais fichiers `*.patch` pour les diffs ciblés

Exemples :

```bash
python patch/py/nom_du_patch.py
git apply --check patch/git/nom_du_patch.patch
git apply patch/git/nom_du_patch.patch
```
