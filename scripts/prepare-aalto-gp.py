"""Aalto CS-E4895 Gaussian Processes: game manifests and authoring evidence (docs/aalto-gp-games-plan.md).

Reads the local course package Open_Courses/aalto-cs-e4895-gaussian-processes/ (inventory.json, package/ PDFs,
upstream/ notebooks) and writes
  framework/games/aalto-gp/manifest.json     33 course games (GP-01..31, GP-S1..S2)
  framework/games/gp-finance/manifest.json    3 finance-bridge games (GP-F1..F3), a separate page under the BS/risk pages
  content/aalto-gp/sources/<id>.md            per-game evidence: lecture page text, GPML page text, assignment task text
Never executes a notebook or any downloaded code: notebooks are read as JSON text.
Run: python -X utf8 scripts/prepare-aalto-gp.py
"""
import json
import os
import re
from pathlib import Path
from urllib.parse import quote

import fitz

REPO = Path(__file__).resolve().parent.parent
SLUG = 'aalto-cs-e4895-gaussian-processes'
COURSE = Path(os.environ.get('OPEN_COURSES_ROOT', REPO.parent / 'Open_Courses')) / SLUG
INVENTORY = json.loads((COURSE / 'inventory.json').read_text(encoding='utf-8'))
COMMIT = INVENTORY['upstreamCommit']
UPSTREAM = {r['relativePath'].removeprefix('upstream/'): r for r in INVENTORY['resources']}

# Published PDFs (package/ paths) by short key.
PDF = {f'L{n}': next(p for p in UPSTREAM if re.fullmatch(rf'Lectures/Lecture {n} .*\.pdf', p)) for n in range(1, 13)}
PDF |= {'SS': 'Lectures/State Space Representation of Gaussian Processes.pdf',
        'S7': 'Special Course in Gaussian Process Lectures/Lecture Session 7.pdf',
        'S11': 'Special Course in Gaussian Process Lectures/Lecture Session 11.pdf',
        'GPML': 'Gaussian Processes for Machine Learning.pdf'}
NB = {f'A{n}': next(p for p in UPSTREAM if re.fullmatch(rf'Assignments/assignment-{n}/.*\.ipynb', p)) for n in range(1, 7)}
NB['lab4'] = 'Special Course in Gaussian Process Assignments/Assignment 4/lab4.ipynb'
for key, path in PDF.items():
    assert UPSTREAM[path]['published'], f'{key} is not published: {path}'

def deck_title(key):
    stem = Path(PDF[key]).stem
    m = re.match(r'^Lecture\s+(\d+)\s+(.*)$', stem)
    if m:
        return f'Lecture {m.group(1)}: {re.sub(r"\s+", " ", m.group(2))}'
    return {'SS': 'State Space Representation of GPs (supplement)', 'S7': 'CS-E4075 Session 7: Convolutional GPs',
            'S11': 'CS-E4075 Session 11: Dynamical GP models', 'GPML': 'Rasmussen & Williams, GPML'}[key]

def asset(key):
    return f'{SLUG}/materials/{quote(Path(PDF[key]).name)}'

# (id, unit, session, kind, en, zh, decks [(key, first, last)], gpml [(section, pdf page)], tasks [(notebook, label, heading regex)])
GAMES = [
    ('GP-01', 1, 'L1', 'topic', 'Covariance matrices and marginals', '协方差矩阵与边缘分布', [('L1', 47, 58)], [('A.2', 218)], [('A1', 'Task 1', r'Task 1')]),
    ('GP-02', 1, 'L1–2', 'topic', 'Conditioning a Gaussian', '高斯分布的条件化', [('L1', 59, 67), ('L2', 2, 4)], [('A.2', 218)], [('A1', 'Task 2', r'Task 2')]),
    ('GP-03', 1, 'L1', 'topic', 'Sampling with a Cholesky factor', '用 Cholesky 因子采样', [('L1', 56, 56), ('L1', 63, 65)], [('A.2', 218), ('A.4', 220)], [('A2', 'Task 2', r'Task 2')]),
    ('GP-04', 1, 'L2', 'topic', 'Bayesian linear regression', '贝叶斯线性回归', [('L2', 6, 16)], [('2.1', 25)], [('A1', 'Tasks 2–3', r'Task [23]')]),
    ('GP-05', 1, 'L2', 'topic', 'From weights to functions', '从权重视角到函数视角', [('L2', 17, 44)], [('2.1.2', 29), ('2.2', 31)], [('A1', 'Task 3', r'Task 3')]),
    ('GP-06', 2, 'L3', 'topic', 'The GP posterior from one or two observations', '一两个观测下的 GP 后验', [('L3', 4, 9)], [('2.2', 31)], [('A2', 'Task 3', r'Task 3')]),
    ('GP-07', 2, 'L3', 'topic', 'Prior means and p(f*|y) versus p(y*|y)', '先验均值与 p(f*|y)、p(y*|y)', [('L3', 7, 12)], [('2.2', 33), ('2.7', 45)], [('A2', 'Task 4a', r'Task 4a')]),
    ('GP-08', 2, 'L3', 'topic', 'Common covariance functions', '常用协方差函数', [('L3', 13, 24)], [('4.2', 99)], [('A2', 'Task 1', r'Task 1')]),
    ('GP-09', 2, 'L3, L5', 'topic', 'Combining kernels and positive semi-definiteness', '核的组合与半正定性', [('L3', 25, 33), ('L5', 22, 23)], [('4.1', 97), ('4.2.4', 112)], []),
    ('GP-10', 2, 'L3', 'topic', 'The marginal likelihood', '边际似然', [('L3', 34, 44)], [('5.4.1', 130)], [('A2', 'Task 4', r'Task 4[c-f]')]),
    ('GP-11', 2, 'L3, L7', 'topic', 'The cost of exact GP regression', '精确 GP 回归的计算量', [('L3', 45, 47), ('L7', 4, 10)], [('Alg. 2.1', 37), ('A.4', 220)], []),
    ('GP-12', 3, 'L4', 'topic', 'Leave-one-out cross-validation in closed form', '留一法交叉验证的闭式', [('L4', 47, 55)], [('5.4.2', 134)], []),
    ('GP-13', 3, 'L4', 'topic', 'Integration, heteroscedastic GPs and basis functions', '积分、异方差 GP 与基函数近似', [('L4', 7, 46)], [('2.7', 45)], []),
    ('GP-14', 4, 'L5', 'topic', 'Kernels as inner products of features', '核即特征的内积', [('L5', 4, 24)], [('4.1', 97), ('2.1.2', 29)], []),
    ('GP-15', 4, 'L5', 'topic', 'Spectral densities and spectral kernels', '谱密度与谱核', [('L5', 30, 64)], [('4.2.1', 100), ('B.1', 226)], [('lab4', 'Spectral mixture kernel', r'(?i)spe?c?r?t?r?al mixture|Sprectal')]),
    ('GP-16', 4, 'L5', 'topic', 'Structured and non-stationary kernels', '结构化核与非平稳核', [('L5', 25, 29), ('L5', 65, 77)], [('4.2.3', 108)], []),
    ('GP-17', 5, 'L6', 'topic', 'Likelihoods, link functions and log-concavity', '似然、链接函数与对数凹性', [('L6', 3, 25)], [('3.1', 52), ('3.3', 57)], []),
    ('GP-18', 5, 'L6', 'topic', 'The Laplace approximation', 'Laplace 近似', [('L6', 26, 60)], [('3.4', 59)], []),
    ('GP-19', 5, 'L6', 'topic', 'Variational inference for classification', '分类问题的变分推断', [('L6', 61, 80)], [('A.5', 221)], [('A3', 'Tasks 1a–1f', r'Task 1[a-f]')]),
    ('GP-20', 6, 'L7', 'topic', 'Grid structure and conjugate gradients', '网格结构与共轭梯度', [('L7', 11, 24)], [('A.3', 219)], []),
    ('GP-21', 6, 'L7', 'topic', 'Nyström approximation and the Woodbury identity', 'Nyström 近似与 Woodbury 恒等式', [('L7', 25, 39)], [('8.1', 189), ('A.3', 219)], []),
    ('GP-22', 6, 'L7', 'topic', 'Sparse variational GPs', '稀疏变分 GP', [('L7', 40, 80)], [('8.3', 193)], [('A4', 'Task 1', r'Task 1|Sparse GP ELBO|Whitened|Optimi[sz]ation')]),
    ('GP-23', 7, 'L8', 'topic', 'RKHS, the representer theorem and kernel ridge regression', 'RKHS、表示定理与核岭回归', [('L8', 2, 12)], [('6.1', 147), ('6.2', 150)], [('A4', 'Task 2', r'Task 2')]),
    ('GP-24', 7, 'L8', 'topic', 'Infinitely wide networks and the neural tangent kernel', '无限宽网络与神经正切核', [('L8', 13, 27)], [('4.2.3', 109)], [('A4', 'Task 3', r'Task 3'), ('A6', 'Task 2', r'Task 2')]),
    ('GP-25', 8, 'L9', 'topic', 'Deep Gaussian processes', '深度高斯过程', [('L9', 1, 74)], [], [('A5', 'Tasks 2–3', r'Task [23]')]),
    ('GP-26', 9, 'L10', 'topic', 'From probabilistic PCA to the GPLVM', '从概率 PCA 到 GPLVM', [('L10', 2, 38)], [('9.11', 214)], [('A5', 'Task 1', r'Task 1')]),
    ('GP-27', 9, 'L10', 'topic', 'Multi-output GPs and coregionalisation', '多输出 GP 与协区域化', [('L10', 39, 71)], [('9.1', 208)], []),
    ('GP-28', 10, 'L11', 'topic', 'Three views of a stationary GP', '平稳 GP 的三种视角', [('L11', 5, 15), ('SS', 7, 17)], [('B.1', 226), ('B.2', 229)], []),
    ('GP-29', 10, 'L11', 'topic', 'Kalman filtering and smoothing in O(n)', 'O(n) 的 Kalman 滤波与平滑', [('L11', 16, 38), ('SS', 18, 25)], [('B.2', 229), ('B.3', 232)], [('A6', 'Task 1', r'Task 1')]),
    ('GP-30', 11, 'L12', 'topic', 'Acquisition functions', '采集函数', [('L12', 6, 30)], [('9.7', 211)], [('A6', 'Task 3', r'Task 3')]),
    ('GP-31', 11, 'L12', 'topic', 'The Bayesian optimisation loop and model-based RL', '贝叶斯优化循环与基于模型的强化学习', [('L12', 30, 41), ('S11', 17, 27)], [], [('A6', 'Task 3', r'Task 3')]),
    ('GP-S1', 12, 'S7', 'bonus', 'Convolutional likelihoods and kernels', '卷积似然与卷积核', [('S7', 1, 38)], [('9.4', 209)], [('lab4', 'Tasks 1–2', r'Task [12]')]),
    ('GP-S2', 12, 'S11', 'bonus', 'Dynamical GP models and nonparametric ODEs', '动力学 GP 模型与非参数 ODE', [('S11', 1, 63)], [], []),
]
BRIDGE = [
    ('GP-F1', 1, 'F1', 'bonus', 'Covariance as a kernel: portfolio variance and factor models', '协方差即核：组合方差与因子模型', [('L2', 17, 24), ('L10', 39, 55)], [('2.1.2', 29), ('2.2', 31)], []),
    ('GP-F2', 1, 'F2', 'bonus', 'Minimum variance, precision matrices and shrinkage', '最小方差、精度矩阵与收缩', [('L4', 47, 49)], [('5.4.2', 134), ('A.3', 219)], []),
    ('GP-F3', 1, 'F3', 'bonus', 'Black–Litterman as a GP posterior', 'Black–Litterman 即 GP 后验', [('L1', 59, 62), ('L3', 4, 9)], [('2.2', 31), ('A.2', 218)], []),
]
UNITS = [
    ['Multivariate Gaussians and Bayesian regression', '多元高斯与贝叶斯回归'], ['Gaussian process regression', '高斯过程回归'],
    ['Integration and model selection', '积分与模型选择'], ['Kernel learning', '核学习'],
    ['Classification and approximate inference', '分类与近似推断'], ['Large-scale Gaussian processes', '大规模高斯过程'],
    ['Theory: RKHS and neural networks', '理论：RKHS 与神经网络'], ['Deep Gaussian processes', '深度高斯过程'],
    ['Latent variables and multiple outputs', '隐变量与多输出'], ['State-space Gaussian processes', '状态空间高斯过程'],
    ['Sequential decision making', '序贯决策'], ['Supplement: CS-E4075 special course', '补充：CS-E4075 专题课'],
]

docs = {key: fitz.open(COURSE / 'package' / path) for key, path in PDF.items()}

def notebook_sections(key, pattern):
    """Markdown and code text of the cells under headings that match `pattern`, up to the next heading of the same or higher level."""
    cells = json.loads((COURSE / 'upstream' / NB[key]).read_text(encoding='utf-8'))['cells']
    out, active_level = [], None
    for cell in cells:
        text = ''.join(cell.get('source', []))
        heading = re.match(r'^\s*(#{1,4})\s+(.*)', text) if cell.get('cell_type') == 'markdown' else None
        bold = re.match(r'^\s*\*\*(Task[^*]*)\*\*', text) if cell.get('cell_type') == 'markdown' else None
        if heading or bold:
            level = len(heading.group(1)) if heading else 5
            title = heading.group(2) if heading else bold.group(1)
            if re.search(pattern, title):
                active_level = level
            elif active_level is not None and level <= active_level:
                active_level = None
        if active_level is not None:
            out.append(f"[{cell.get('cell_type')}]\n{text.strip()}")
    return '\n\n'.join(out)

def build(entries, manifest_path, course_meta):
    games = []
    for seq, (gid, unit, session, kind, en, zh, decks, gpml, tasks) in enumerate(entries, 1):
        main = decks[0][0]
        sources = [dict(kind='notes', title=f'{deck_title(k)} · pp. {a}–{b}' if a != b else f'{deck_title(k)} · p. {a}', asset=asset(k), filename=Path(PDF[k]).name, page=a) for k, a, b in decks]
        sources += [dict(kind='textbook', title=f'GPML §{sec}', asset=asset('GPML'), filename=Path(PDF['GPML']).name, page=page) for sec, page in gpml]
        sources += [dict(kind='assignment', title=f"{'CS-E4075 lab 4' if nb == 'lab4' else 'Assignment ' + nb[1:]} · {label}", href=UPSTREAM[NB[nb]]['upstreamUrl']) for nb, label, _ in tasks]
        games.append(dict(id=gid, sequence=seq, unit=unit, session=session, kind=kind, title=dict(en=en, zh=zh),
                          officialUrl=UPSTREAM[PDF[main]]['upstreamUrl'], sources=sources))
        evidence = [f'# {gid} {en} / {zh}', '', f'Unit {unit}. Sources (local PDF page numbers are physical pages).', '']
        for k, a, b in decks:
            evidence.append(f'## {deck_title(k)}, pp. {a}–{b}')
            for p in range(a, b + 1):
                evidence.append(f'### p. {p}\n{docs[k][p - 1].get_text().strip()}')
        for sec, page in gpml:
            evidence.append(f'## GPML §{sec}, pdf pp. {page}–{page + 3}')
            for p in range(page, min(page + 4, len(docs["GPML"]) + 1)):
                evidence.append(f'### pdf p. {p}\n{docs["GPML"][p - 1].get_text().strip()}')
        for nb, label, pattern in tasks:
            text = notebook_sections(nb, pattern)
            if not text:
                raise RuntimeError(f'{gid}: no notebook cells match {pattern!r} in {NB[nb]}')
            evidence.append(f'## {NB[nb]} · {label} (notebook text, not executed)\n{text}')
        target = REPO / 'content' / 'aalto-gp' / 'sources' / f'{gid}.md'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text('\n\n'.join(evidence) + '\n', encoding='utf-8')
    manifest = dict(**course_meta, version=1, games=games)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{manifest_path.relative_to(REPO)}: {len(games)} games')

meta = dict(course=SLUG, officialUrl=INVENTORY['packageUrl'], upstreamCommit=COMMIT, license=None,
            attribution='Aalto University CS-E4895 Gaussian Processes (2023) and CS-E4075 Special course on Gaussian processes; slides © their lecturers. Mirror: github.com/SpringNuance/Gaussian-Processes. GPML © Rasmussen & Williams, MIT Press 2006.')
build(GAMES, REPO / 'framework' / 'games' / 'aalto-gp' / 'manifest.json', dict(meta, units=UNITS))
build(BRIDGE, REPO / 'framework' / 'games' / 'gp-finance' / 'manifest.json',
      dict(meta, units=[['Finance bridge (extension, not course content)', '金融桥接（扩展，非课程内容）']]))
