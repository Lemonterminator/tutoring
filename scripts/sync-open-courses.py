"""Publish the downloaded university materials and an additive, sourced course graph."""
import hashlib
import html
import json
import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, unquote

import fitz

REPO = Path(__file__).resolve().parent.parent
ROOT = Path(os.environ.get('OPEN_COURSES_ROOT', REPO.parent / 'Open_Courses'))
if os.name == 'nt':
    # OCW's original filenames can exceed Windows' legacy MAX_PATH limit.
    REPO = Path('\\\\?\\' + str(REPO.resolve()))
    ROOT = Path('\\\\?\\' + str(ROOT.resolve()))
PUBLIC = REPO / 'public' / 'open-courses'
GRAPH = REPO / 'public' / 'concept-graph'
COURSES = [
    ('18-06sc-linear-algebra-fall-2011', 'MIT-18.06SC', 'LA', 'Linear Algebra', '线性代数', '2011'),
    ('18-02sc-multivariable-calculus-fall-2010', 'MIT-18.02SC', 'CALC', 'Multivariable Calculus', '多元微积分', '2010'),
    ('6-041sc-probabilistic-systems-analysis-and-applied-probability-fall-2013', 'MIT-6.041SC', 'PROB', 'Probabilistic Systems Analysis and Applied Probability', '应用概率与概率系统分析', '2013'),
    ('18-650-statistics-for-applications-fall-2016', 'MIT-18.650', 'INF', 'Statistics for Applications', '统计推断与应用', '2016'),
    ('aalto-probability-theory-2024', 'MS-E1600', 'MEAS', 'Probability Theory — A fast course', '测度概率论', '2024'),
    ('18-065-matrix-methods-in-data-analysis-signal-processing-and-machine-learning-spring-2018', 'MIT-18.065', 'MAT', 'Matrix Methods in Data Analysis, Signal Processing, and Machine Learning', '数据分析、信号处理与机器学习中的矩阵方法', '2018'),
    # GitHub mirror (no license, local only); package/ holds hard links to the PDFs chosen for publication, see its inventory.json.
    ('aalto-cs-e4895-gaussian-processes', 'CS-E4895', 'GP', 'Gaussian Processes', '高斯过程', '2023'),
]
GP_REPO = 'https://github.com/SpringNuance/Gaussian-Processes'

def gp_label(stem):
    """'Lecture 3 Gaussian process regression' -> 'Lecture 3: Gaussian process regression'; CS-E4075 sessions keep their course code."""
    match = re.match(r'^Lecture\s+(\d+)\s+(.*)$', stem)
    if match:
        return f'Lecture {match.group(1)}: {re.sub(r"\s+", " ", match.group(2))}'
    match = re.match(r'^Lecture Session\s+(\d+)$', stem)
    return f'CS-E4075 Session {match.group(1)}' if match else stem

def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()

def copy(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists() or source.stat().st_size != target.stat().st_size or sha(source) != sha(target):
        shutil.copyfile(source, target)

def plain(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', value or ''))).strip()

def normalize(value):
    return re.sub(r'[^a-z0-9]', '', value.lower())

def clean_title(value):
    value = plain(value)
    value = re.sub(r'^(?:Lecture[s]?|Session)\s+[\d\s–-]+(?:\s+Clip\s+\d+)?\s*:\s*', '', value, flags=re.I)
    return re.sub(r'\s+Video$', '', value, flags=re.I).strip()

def slugify(value):
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')[:110] or hashlib.sha256(value.encode()).hexdigest()[:12]

base = read_json(GRAPH / 'graph.json')
canonical = {normalize(n['name']): n['id'] for n in base['nodes']}
for node in base['nodes']:
    for alias in node['aliases_en']:
        canonical.setdefault(normalize(alias), node['id'])
ALIASES = {
    'projectionsontosubspaces': 'orthogonal-projection',
    'projectionmatricesandleastsquares': 'linear-least-squares',
    'leastsquares': 'linear-least-squares',
    'regression': 'regression-analysis',
    'parametricinferenc': 'statistical-inference',
    'parametricinference': 'statistical-inference',
    'parametrichypothesistesting': 'statistical-hypothesis-test',
    'testinggoodnessoffit': 'goodness-of-fit-test',
    'eigenvaluesandeigenvectors': 'eigenvalue-decomposition',
    'symmetricmatricesandpositivedefiniteness': 'positive-definite-matrix',
    'independence': 'independence',
    'sigma-algebras': 'sigma-algebra',
    'almostsureconvergence': 'almost-sure-convergence',
    'convergenceinprobability': 'convergence-in-probability',
    'convergenceindistribution': 'convergence-in-distribution',
}
base_ids = {n['id'] for n in base['nodes']}
canonical.update({normalize(k): v for k, v in ALIASES.items() if v in base_ids})
nodes, edges, memberships, documents, catalog = {}, [], {}, {}, []

def make_node(node_id, name, course, zh='', kind='course_topic'):
    return dict(id=node_id, name=name, aliases_en=[], aliases_fi=[], aliases_zh=[zh] if zh else [],
                definition=f'Course topic: {name}. The linked original material supplies the definitions, derivations and examples.' if kind != 'course' else f'University course: {name}. Explore its topics and complete downloaded material collection.',
                courses=[course], introduced_in=[], used_in=[], prereq_depth=0, root=False, degree=0,
                status='auto', origin='open-course', kind=kind,
                notes='课程专题索引，依据官方课件标题与章节目录建立；课程覆盖边不表示先修关系。')

for slug, course_id, short, title_en, title_zh, year in COURSES:
    directory = ROOT / slug
    inventory = read_json(directory / 'inventory.json')
    package = directory / 'package'
    if not package.is_dir():
        raise RuntimeError(f'Missing downloaded package: {slug}')
    official = GP_REPO if short == 'GP' else f'https://ocw.mit.edu/courses/{slug}/' if short != 'MEAS' else 'https://math.aalto.fi/~lleskela/LectureNotes006.html'
    upstream_urls = {r['relativePath'].removeprefix('upstream/'): r['upstreamUrl'] for r in inventory['resources'] if r.get('published')} if short == 'GP' else {}
    hub_id = f'open-course-{slug}'
    hub = make_node(hub_id, f'{course_id}: {title_en}', course_id, title_zh, 'course')
    nodes[hub_id] = hub
    metadata = []
    for path in sorted(package.glob('resources/*/data.json')):
        record = read_json(path)
        record['_resource_page'] = path.parent.relative_to(package).as_posix() + '/index.html'
        metadata.append(record)
    # Resource Index repeats official records; UID identifies one actual resource.
    unique = {}
    for record in metadata:
        key = record.get('uid') or record['_resource_page']
        previous = unique.get(key)
        if not previous or (previous.get('parent_title') == 'Resource Index' and record.get('parent_title') != 'Resource Index'):
            unique[key] = record
    metadata = list(unique.values())
    file_metadata = {}
    video_links = {}
    for record in metadata:
        if record.get('file'):
            basename = unquote(record['file'].split('/')[-1])
            file_metadata.setdefault(basename, record)
        if 'Lecture Videos' in record.get('learning_resource_types', []):
            youtube_id = record.get('video_metadata', {}).get('youtube_id')
            if youtube_id:
                video_links.setdefault(youtube_id, dict(title=plain(record.get('title')), url=official + record['_resource_page'].replace('index.html', '')))
            for transcript in record.get('video_files', {}).get('video_transcript_resources', []):
                file_metadata.setdefault(unquote(transcript['file'].split('/')[-1]), record)
    resources, by_basename, pdf_cache = [], {}, {}
    for pdf in sorted(package.rglob('*.pdf')):
        relative = pdf.relative_to(package).as_posix()
        digest = sha(pdf)
        with fitz.open(pdf) as opened:
            pages = len(opened)
            opening = opened[0].get_text() if pages else ''
        record = file_metadata.get(pdf.name, {})
        types = record.get('learning_resource_types', [])
        label = plain(record.get('title')) or pdf.stem
        if short == 'MEAS':
            label = title_en
        if short == 'GP':
            if digest != next(r['sha256'] for r in inventory['resources'] if r['relativePath'] == f'upstream/{relative}'):
                raise RuntimeError(f'Hash mismatch against inventory: {slug}/{relative}')
            label = gp_label(pdf.stem)
        if 'Lecture Notes' in types and record.get('parent_title') not in (None, 'Lecture Slides', 'Resource Index'):
            label = record['parent_title']
        official_title = label
        if short == 'INF' and 'To Be Deleted' in label:
            if 'Method_of_Moments' in pdf.name:
                label = 'The Method of Moments'
            elif 'Bayesian_Statistics' in pdf.name:
                label = 'Bayesian Statistics'
        # Public assets keep original filenames/content. Local graph copies use stable IDs.
        target = PUBLIC / slug / 'materials' / pdf.name
        copy(pdf, target)
        if pdf.name in by_basename and by_basename[pdf.name]['sha256'] != digest:
            raise RuntimeError(f'Conflicting PDF basename: {slug}/{pdf.name}')
        doc_id = f'OCW__{slug}__{digest[:20]}'
        category = '讲义与课件' if 'Lecture Notes' in types or short in ('MEAS', 'GP') else '答案' if any('Solutions' in t for t in types) else '习题与考试' if any(t in types for t in ['Problem Sets', 'Exams']) else '视频文字稿' if 'Lecture Videos' in types else '其他材料'
        resource = dict(title=label, officialTitle=official_title, filename=pdf.name, relativePath=relative, pages=pages,
                        bytes=pdf.stat().st_size, sha256=digest, category=category,
                        url=f'{slug}/materials/{quote(pdf.name)}', docId=doc_id,
                        officialUrl=upstream_urls[relative] if short == 'GP' else official + record.get('_resource_page', '').replace('index.html', ''))
        by_basename[pdf.name] = resource
        pdf_cache[doc_id] = (pdf, opening)
        resources.append(resource)
    resources = list({r['docId']: r for r in resources}.values())
    topics = []
    if short == 'GP':
        # One topic per lecture deck (CS-E4895 lectures, the state-space supplement, the two CS-E4075-only sessions); not GPML.
        for resource in resources:
            if resource['filename'].startswith('Gaussian Processes for Machine Learning'):
                continue
            title = re.sub(r'^(?:Lecture \d+|CS-E4075 Session \d+):\s*', '', resource['title'])
            title = {'Introduction': 'Introduction to Gaussian processes', 'Deep gaussian processes': 'Deep Gaussian processes'}.get(title, title)
            if resource['title'].startswith('CS-E4075'):
                title = {'CS-E4075 Session 7': 'Convolutional Gaussian processes', 'CS-E4075 Session 11': 'Dynamical Gaussian process models'}[resource['title']]
            topics.append(dict(title=title, resource=resource, page=1, excerpt=pdf_cache[resource['docId']][1][:240]))
    elif short == 'MEAS':
        pdf = next(package.glob('*.pdf'))
        resource = by_basename[pdf.name]
        with fitz.open(pdf) as opened:
            for level, heading, page in opened.get_toc():
                if level != 1 and not any(word in heading.lower() for word in ['sigma-algebra', 'conditional expectation', 'almost sure convergence', 'convergence in probability', 'convergence in distribution', 'law of large numbers', 'central limit', 'jensen', 'borel', 'probability kernels']):
                    continue
                if heading in ['Preface', 'Notations', 'Bibliography', 'Index'] or page < 1:
                    continue
                topics.append(dict(title=heading, resource=resource, page=page, excerpt=opened[page - 1].get_text()[:240]))
    else:
        for record in metadata:
            types = record.get('learning_resource_types', [])
            if short == 'MAT':
                if 'Lecture Videos' not in types or not re.match(r'^Lecture\s+\d+\s*:', record.get('title', ''), re.I):
                    continue
                files = record.get('video_files', {}).get('video_transcript_resources', [])
                if not files:
                    continue
                filename = unquote(files[0]['file'].split('/')[-1])
                title = clean_title(record['title'])
            else:
                if 'Lecture Notes' not in types or not record.get('file'):
                    continue
                filename = unquote(record['file'].split('/')[-1])
                resource = by_basename.get(filename)
                if not resource:
                    continue
                title = clean_title(resource['title'])
                if short == 'INF' and 'To Be Deleted' in title:
                    title = 'The Method of Moments' if 'Method_of_Moments' in filename else 'Bayesian Statistics'
                if short == 'LA' and (not record.get('parent_title') or re.search(r'review|exam', title, re.I)):
                    continue
            resource = by_basename.get(filename)
            if not resource:
                raise RuntimeError(f'Missing topic PDF: {slug}/{filename}')
            topics.append(dict(title=title, resource=resource, page=1, excerpt=pdf_cache[resource['docId']][1][:240]))
    topics = list({(t['title'], t['resource']['docId'], t['page']): t for t in topics}.values())
    # Calculus sessions often use a video transcript instead of a separate note.
    # Include those official session topics too, keeping reviews in the material catalog.
    if short == 'CALC':
        for record in metadata:
            parent = record.get('parent_title', '') or ''
            if 'Lecture Videos' not in record.get('learning_resource_types', []) or not re.match(r'^Session\s+\d+:', parent):
                continue
            title = clean_title(parent)
            if re.search(r'exam|review', title, re.I):
                continue
            files = record.get('video_files', {}).get('video_transcript_resources', [])
            if not files:
                continue
            resource = by_basename.get(unquote(files[0]['file'].split('/')[-1]))
            if resource:
                topics.append(dict(title=title, resource=resource, page=1, excerpt=pdf_cache[resource['docId']][1][:240]))
        topics = list({(t['title'], t['resource']['docId'], t['page']): t for t in topics}.values())
    for topic in topics:
        title = topic['title']
        canonical_id = canonical.get(normalize(title))
        node_id = canonical_id or f'ocw-{short.lower()}-{slugify(title)}'
        location = dict(course=course_id, doc=topic['resource']['docId'], pages=[topic['page']])
        if canonical_id:
            member = memberships.setdefault(node_id, dict(id=node_id, courses=[], locations=[]))
            if course_id not in member['courses']:
                member['courses'].append(course_id)
            if location not in member['locations']:
                member['locations'].append(location)
        else:
            node = nodes.setdefault(node_id, make_node(node_id, title, course_id))
            if location not in node['introduced_in']:
                node['introduced_in'].append(location)
        hub_location = dict(course=course_id, doc=topic['resource']['docId'], pages=[topic['page']])
        if not hub['introduced_in']:
            hub['introduced_in'].append(hub_location)
        edges.append(dict(src=node_id, dst=hub_id, rel='covered_in', confidence=1, support=1, in_dag=False,
                          quote_verified=True, evidence=[dict(doc=topic['resource']['docId'], page=topic['page'],
                          quote=topic['excerpt'], verified=True, note=f'Official course topic: {title}. Course coverage only; not a prerequisite assertion.')]))
        topic['nodeId'] = node_id
        resource = topic['resource']
        topic['resourceUrl'] = resource['url'] + f"#page={topic['page']}"
        source_pdf = pdf_cache[resource['docId']][0]
        copy(source_pdf, GRAPH / 'open-sources' / f"{resource['docId']}.pdf")
        documents[resource['docId']] = dict(url=f"open-sources/{resource['docId']}.pdf", filename=resource['title'] if resource['title'].lower().endswith('.pdf') else resource['title'] + '.pdf',
                                           pages=resource['pages'], available=True, sourceFolder='open-sources')
        del topic['resource']
    grouped_topics = {}
    for topic in topics:
        source = dict(page=topic['page'], resourceUrl=topic['resourceUrl'])
        if topic['nodeId'] not in grouped_topics:
            grouped_topics[topic['nodeId']] = {**topic, 'sources': []}
        sources = grouped_topics[topic['nodeId']]['sources']
        if source not in sources:
            sources.append(source)
    topics = list(grouped_topics.values())
    archives = list((directory / 'archive').glob('*.zip')) if (directory / 'archive').is_dir() else []
    archive = archives[0] if archives else None
    archive_info = None
    if archive:
        digest = sha(archive)
        if digest != inventory.get('archiveSha256'):
            raise RuntimeError(f'Archive hash mismatch: {slug}')
        copy(archive, PUBLIC / slug / archive.name)
        archive_info = dict(filename=archive.name, url=f'{slug}/{quote(archive.name)}', bytes=archive.stat().st_size, sha256=digest)
    catalog.append(dict(slug=slug, id=course_id, short=short, university='Aalto' if short in ('MEAS', 'GP') else 'MIT',
                        title=dict(en=title_en, zh=title_zh), year=year, officialUrl=official,
                        packageUrl=inventory.get('packageUrl'), archive=archive_info,
                        packageKind='public-notes' if short == 'MEAS' else 'github-mirror' if short == 'GP' else 'official-ocw-zip',
                        pdfCount=len(resources), materialBytes=sum(r['bytes'] for r in resources),
                        videosDownloaded=False, videos=list(video_links.values()), resources=resources, topics=topics,
                        hubNode=hub_id))
    print(f'{short}: {len(resources)} unique PDFs; {len(topics)} sourced topics; {len(video_links)} video entries (links only).')

now = datetime.now(timezone.utc).isoformat()
grouped_edges = {}
for edge in edges:
    key = (edge['src'], edge['dst'], edge['rel'])
    if key not in grouped_edges:
        grouped_edges[key] = {**edge, 'evidence': []}
    grouped = grouped_edges[key]
    for evidence in edge['evidence']:
        if not any((item['doc'], item['page']) == (evidence['doc'], evidence['page']) for item in grouped['evidence']):
            grouped['evidence'].append(evidence)
    grouped['support'] = len({item['doc'] for item in grouped['evidence']})
edges = list(grouped_edges.values())
write_json(PUBLIC / 'catalog.json', dict(version=1, generatedAt=now, courses=catalog))
write_json(GRAPH / 'open-courses.json', dict(version=1, generatedAt=now, nodes=list(nodes.values()), edges=edges,
           memberships=list(memberships.values()), documents=documents,
           summary=dict(courses=len(catalog), topics=sum(len(c['topics']) for c in catalog), matchedConcepts=len(memberships))))
print(f'Published {len(catalog)} courses, {len(nodes)} new index nodes, {len(memberships)} existing concept matches and {len(edges)} coverage edges. Original graph.json unchanged.')
