"""Builds train_glowtrace_v8_kaggle.ipynb from multitask.py and fetch_datasets.py, so the notebook
always carries the exact tested code. Run after changing either script:
  python3 research/vision/build_notebook.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "train_glowtrace_v8_kaggle.ipynb")


def cell(kind, text):
    lines = text.split("\n")
    source = [line + "\n" for line in lines[:-1]] + [lines[-1]]
    if kind == "markdown":
        return {"cell_type": "markdown", "metadata": {}, "source": source}
    return {"cell_type": "code", "metadata": {}, "source": source, "outputs": [], "execution_count": None}


INTRO = """# Glowtrace training v8 on Kaggle (free GPU): skin texture with both labelling rounds

About 2 to 3 hours of GPU. Retrains the skin surface model (texture, shine, breakouts) on close-up
skin patches from every licensed skin source: 12 Roboflow sets (including real selfies with marked
pores and roughness), Google SCIN, FairFace, Unsplash Lite faces and your team photos.

**New in v8:** Debbie's second labelling round (real face skin, every skin tone; 426 answers
across both rounds, in the updated `glowtrace-labels` dataset).

**From v7:** v6 learnt to ignore blur, because camera blur was added to each view separately and
unlabelled. v7 shares lens and phone processing between both views, anchors a blurred copy of each
patch to its own measured detail, and judges blur against what it does to measured detail. In a
short test this took texture from r 0.68 to 0.95 and blur from 57% to 84% of the ideal.
Also: the fine-detail input channel (v6) and Debbie's "which is smoother" answers (`glowtrace-labels`).

**Each run**
1. **Create → New Notebook → File → Import Notebook**, and choose this file.
2. Right-hand panel: **Accelerator → GPU T4 x2**, **Internet on**.
3. **Input → Add Input → Your Datasets**: add `glowtrace-team` (and `glowtrace-labels` once Debbie's answers are in).
4. **Add-ons → Secrets**: tick `ROBOFLOW_API_KEY` for this notebook.
5. **Save Version → Save & Run All (Commit) → Save**. You can close the tab.
6. When it's finished: open the version → **Output** → download `glowtrace_results_v8.zip` and send it to Claude.

**Built not to waste a run:** cell 1 checks GPU, internet, key and inputs within a minute and says exactly what to fix.
Cell 5 is a 2-minute practice run of the whole pipeline. Training saves as it goes, and the results zip is always made,
with the full log, even if something fails."""

PREFLIGHT = """# 1. Pre-flight: checks everything before any long step; stops with a plain message if something is missing.
import os, glob, shutil, json, subprocess, urllib.request, urllib.error, torch
ROOT = os.environ.get('GLOWTRACE_ROOT', '/kaggle')
problems, notes = [], []
if not torch.cuda.is_available() and not os.environ.get('GLOWTRACE_ALLOW_CPU'):
    problems.append('No GPU: in the right-hand panel set Accelerator to GPU T4 x2.')
try:
    urllib.request.urlopen('https://storage.googleapis.com/dx-scin-public-data/dataset/scin_cases.csv', timeout=30).read(100)
except Exception:
    problems.append('No internet: in the right-hand panel turn Internet on (needs a verified phone number).')
try:
    from kaggle_secrets import UserSecretsClient
    os.environ['ROBOFLOW_API_KEY'] = UserSecretsClient().get_secret('ROBOFLOW_API_KEY')
except Exception:
    problems.append('Roboflow key missing: Add-ons > Secrets > add ROBOFLOW_API_KEY and tick it for this notebook.')
if os.environ.get('ROBOFLOW_API_KEY') and not os.environ.get('GLOWTRACE_SKIP_ROBOFLOW'):
    try:
        urllib.request.urlopen('https://api.roboflow.com/?api_key=' + os.environ['ROBOFLOW_API_KEY'], timeout=30).read(100)
    except urllib.error.HTTPError as error:
        if error.code in (401, 403):
            problems.append('Roboflow rejected the key: copy a fresh one from roboflow.com > Settings > API Keys into Add-ons > Secrets > ROBOFLOW_API_KEY.')
    except Exception:
        notes.append('Could not reach Roboflow to check the key; carrying on.')
if not glob.glob(f'{ROOT}/input/**/glowtrace_team', recursive=True):
    notes.append('Team photos not attached (Input > Your Datasets > glowtrace-team). Training continues without them.')
# Debbie's texture rounds must all be here: round 1 (SCIN) and round 2 (face skin). Training stops
# rather than quietly run without one (v9 and v10 both ran on round 1 alone).
REQUIRED_ROUNDS = {'a326117d6bc85876': 'round 1', '6aba2d5e473d6e3f': 'round 2'}
# Gather every labels file from anywhere in the inputs (a second dataset, a subfolder from a zip)
# into one folder, so no round is missed because it sits in a different place.
label_npz = glob.glob(f'{ROOT}/input/**/label_patches*.npz', recursive=True)
LABELS = None
if label_npz:
    import numpy as np
    LABELS = os.path.join(os.environ.get('GLOWTRACE_WORKDIR', f'{ROOT}/working'), 'labels')
    shutil.rmtree(LABELS, ignore_errors=True)
    os.makedirs(LABELS)
    # One patch file and one answers file per round, even if a round is attached twice.
    by_round = {}
    for path in sorted(label_npz):
        by_round.setdefault(str(np.load(path)['set_id']), path)
    for sid, path in by_round.items():
        shutil.copy(path, f'{LABELS}/label_patches_{sid}.npz')
    best = {}
    for path in sorted(glob.glob(f'{ROOT}/input/**/glowtrace_labels_*.json', recursive=True)):
        try:
            data = json.load(open(path))
        except Exception:
            continue
        sid, n = data.get('setId'), len(data.get('answers', []))
        if sid in by_round and n > best.get(sid, (None, -1))[1]:
            best[sid] = (path, n)
    for sid, (path, _) in best.items():
        shutil.copy(path, f'{LABELS}/glowtrace_labels_{sid}.json')
    # Every labelling round has its own patch file; answers count only for a round that's attached.
    set_ids = {str(np.load(path)['set_id']) for path in glob.glob(f'{LABELS}/**/label_patches*.npz', recursive=True)}
    per_set = {}
    for path in glob.glob(f'{LABELS}/**/*.json', recursive=True):
        try:
            data = json.load(open(path))
        except Exception:
            continue
        if isinstance(data, dict) and data.get('setId') in set_ids:
            per_set[data['setId']] = per_set.get(data['setId'], 0) + sum(a.get('choice') in ('a', 'b', 'same') for a in data.get('answers', []))
    answers = sum(per_set.values())
    missing = [name for sid, name in REQUIRED_ROUNDS.items() if per_set.get(sid, 0) < 50]
    if missing:
        problems.append("Debbie's labels " + ' and '.join(missing) + ' not found: in Input, remove glowtrace-labels and add it again (its newest version), with all 4 files: label_patches.npz, label_patches_round2.npz and both glowtrace_labels_*.json.')
    if answers < 50:
        notes.append(f"Debbie's labels attached but only {answers} usable answers: training without them.")
        LABELS = None
    else:
        notes.append(f"Debbie's labels: {answers} answers across {len(per_set)} rounds " + json.dumps(per_set) + ".")
else:
    problems.append("Debbie's labels not attached: Input > Add Input > Your Datasets > glowtrace-labels (newest version, all 4 files).")
for n in notes: print('note:', n)
if problems:
    raise SystemExit('Fix these, then Save Version again:\\n- ' + '\\n- '.join(problems))
print('Pre-flight passed.')"""

SETUP = """# 2. Tools and folders.
!pip install -q onnx roboflow mediapipe pandas pyarrow
WORK = os.environ.get('GLOWTRACE_WORKDIR', f'{ROOT}/working')
os.chdir(WORK)
OUT = f'{WORK}/results'
os.makedirs(OUT, exist_ok=True)
os.environ.setdefault('GLOWTRACE_WORK', f'{WORK}/cache')
LOG = open(f'{OUT}/run_log.txt', 'a')
def log(message):
    print(message, flush=True); LOG.write(message + '\\n'); LOG.flush()
log('setup done')"""

DOWNLOAD = """# 4. Download every skin dataset (about 15-25 minutes): Roboflow sets, FairFace, Unsplash Lite faces.
# Each source that fails is skipped with a FAIL line; the run carries on with the rest.
fetch = subprocess.run(['python', 'fetch_datasets.py', 'skin'], capture_output=True, text=True)
print(fetch.stdout[-6000:]); log(fetch.stdout[-6000:])
if fetch.returncode != 0: log('fetch_datasets stderr:\\n' + fetch.stderr[-3000:])
for found in glob.glob(f'{ROOT}/input/**/skin/glowtrace_team', recursive=True):
    shutil.copytree(found, 'data/skin/glowtrace_team', dirs_exist_ok=True)
counts = {d: sum(len(f) for _, _, f in os.walk(f'data/skin/{d}')) for d in sorted(os.listdir('data/skin'))} if os.path.isdir('data/skin') else {}
log('skin photos by source: ' + json.dumps(counts))
if sum(counts.values()) < 200:
    raise SystemExit('Too few skin photos downloaded; send Claude a screenshot of this cell.')"""

def train_args(name, quick):
    return f"""['python', 'multitask.py', 'skin', '--images', 'data/skin', '--heads', 'texture,shine,breakouts',
        '--name', '{name}', '--size', '128', '--patches']{" + ['--quick']" if quick else ""} + (['--labels', LABELS] if LABELS else [])"""

SMOKE = f"""# 5. Practice run (about 2 minutes): the whole pipeline on a few photos. Any code problem stops here, not hours in.
env = dict(os.environ, GLOWTRACE_EPOCHS='1', GLOWTRACE_STEPS='2', GLOWTRACE_WORK=f'{{WORK}}/smoke')
smoke = subprocess.run({train_args('smoke', True)}, env=env, capture_output=True, text=True)
log('practice run:\\n' + smoke.stdout[-1500:])
if smoke.returncode != 0 or not os.path.exists('smoke_weights.json'):
    log(smoke.stderr[-3000:])
    raise SystemExit('Practice run failed: send Claude a screenshot of this cell.')
for f in glob.glob('smoke_*'): os.remove(f)
shutil.rmtree(f'{{WORK}}/smoke', ignore_errors=True)
log('Practice run passed.')"""

TRAIN = f"""# 6. Train the v8 skin surface model (about 1.5-2.5 hours). Output streams to the log as it goes.
name = 'skin-surface'
if os.path.exists(f'{{OUT}}/{{name}}_weights.json'):
    log(f'{{name}}: already done')
else:
    log(f'=== {{name}} ===')
    process = subprocess.Popen({train_args('skin-surface', False)}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in process.stdout:
        print(line, end=''); LOG.write(line)
    process.wait(); LOG.flush()
    for f in glob.glob(f'{{name}}_*'): shutil.copy(f, OUT)
    log(f'{{name}}: exit code {{process.returncode}}, saved ' + ', '.join(sorted(os.path.basename(f) for f in glob.glob(f'{{OUT}}/{{name}}_*'))))"""

ZIP = """# 7. One zip with the model, its evaluation, the dataset credits and the full log. Always made.
import zipfile
if os.path.exists('data/credits.json'): shutil.copy('data/credits.json', OUT)
LOG.close()
with zipfile.ZipFile(f'{WORK}/glowtrace_results_v8.zip', 'w') as zf:
    for f in glob.glob(f'{OUT}/*'):
        zf.write(f, os.path.basename(f))
print(sorted(os.path.basename(f) for f in glob.glob(f'{OUT}/*')))
# Keep the output small: Kaggle saves everything in the working folder.
shutil.rmtree('data', ignore_errors=True); shutil.rmtree('cache', ignore_errors=True)
print('Done: glowtrace_results_v8.zip')"""


def main():
    multitask = open(os.path.join(HERE, "multitask.py")).read().rstrip("\n")
    fetch = open(os.path.join(HERE, "fetch_datasets.py")).read().rstrip("\n")
    exclude = open(os.path.join(HERE, "roboflow_skintone_exclude.txt")).read().rstrip("\n")
    cells = [
        cell("markdown", INTRO),
        cell("code", PREFLIGHT),
        cell("code", SETUP),
        cell("code", "%%writefile multitask.py\n" + multitask),
        cell("code", "%%writefile fetch_datasets.py\n" + fetch),
        cell("code", "%%writefile roboflow_skintone_exclude.txt\n" + exclude),
        cell("code", DOWNLOAD),
        cell("code", SMOKE),
        cell("code", TRAIN),
        cell("code", ZIP),
    ]
    notebook = {
        "cells": cells,
        "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}, "language_info": {"name": "python"}},
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    json.dump(notebook, open(OUT, "w"), indent=1)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
