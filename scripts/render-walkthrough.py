"""Render captions from an actual npm run demo result. Requires Pillow and ffmpeg."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument('--ffmpeg', default=shutil.which('ffmpeg'))
args = parser.parse_args()
if not args.ffmpeg:
    parser.error('Supply --ffmpeg /path/to/ffmpeg')
root = Path(__file__).resolve().parents[1]
report = json.loads((root / 'demo/generated/results.json').read_text())
output = root / 'demo'
frames = output / 'generated/frames'
frames.mkdir(parents=True, exist_ok=True)
font_path = next((p for p in ['/System/Library/Fonts/Supplemental/Arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'] if Path(p).exists()), None)

def font(size):
    return ImageFont.truetype(font_path, size) if font_path else ImageFont.load_default(size=size)

def wrapped(draw, text, size, width):
    lines, current = [], ''
    for word in text.split():
        proposed = f'{current} {word}'.strip()
        if draw.textlength(proposed, font=font(size)) > width and current:
            lines.append(current)
            current = word
        else:
            current = proposed
    return lines + [current]

scenes = [dict(title='Find the words you remember.', label='LANTERN ARCHIVE',
    body='Offline semantic search through letters, journals and notes. Ask in your own words; read the original passage.',
    footer='Recorded offline results | Fictional example archive', seconds=6),
    dict(title='Start with a folder of text.', label='TRY IT',
    body='npm ci\nnpm run setup:model\nnode src/cli.mjs index examples/letters memories.lantern.json\nnode src/cli.mjs ask memories.lantern.json "Who fixed the broken timepiece?"',
    footer='One-time online setup. Index and search locally.', seconds=8)]
for result in report['results']:
    top = result['matches'][0]
    scenes.append(dict(title=result['question'], label='ASK YOUR ARCHIVE', body=top['quote'],
        footer=f'{top["file"]}:{top["lineStart"]}-{top["lineEnd"]}   |   similarity {top["similarity"]:.3f}', seconds=9))
scenes.append(dict(title='Original words. Open model.', label='REPRODUCIBLE RESULTS',
    body=f'{report["files"]} files / {report["passages"]} passages\n384-dimensional MiniLM embeddings\n{report["attemptedRequests"]} attempted fetch requests in this run\n9 core tests + 1 real-model test passed',
    footer='Run npm test, npm run test:model and npm run demo', seconds=7))
for number, scene in enumerate(scenes):
    im = Image.new('RGB', (1280, 720), '#141d24')
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle((70, 59, 92, 81), radius=5, fill='#edc17b')
    draw.text((108, 56), scene['label'], font=font(22), fill='#edc17b')
    y = 135
    for line in wrapped(draw, scene['title'], 48, 1110):
        draw.text((70, y), line, font=font(48), fill='#f6f2e9')
        y += 58
    y += 30
    size = 27 if number == 1 else 34
    for paragraph in scene['body'].split('\n'):
        for line in wrapped(draw, paragraph, size, 1110):
            draw.text((70, y), line, font=font(size), fill='#c7d4db')
            y += size + 13
        if number in (1, len(scenes) - 1):
            y += 7
    assert y < 625, (number, y)
    draw.line((70, 642, 1210, 642), fill='#34464e', width=2)
    draw.text((70, 663), scene['footer'], font=font(22), fill='#9cb0bc')
    draw.text((1180, 663), f'{number + 1:02}', font=font(22), fill='#edc17b')
    im.save(frames / f'{number:02}.png')

writer = subprocess.Popen([args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1280x720', '-r', '10', '-i', '-',
    '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart',
    str(output / 'walkthrough.mp4')], stdin=subprocess.PIPE)
try:
    for number, scene in enumerate(scenes):
        pixels = Image.open(frames / f'{number:02}.png').tobytes()
        for _ in range(scene['seconds'] * 10):
            writer.stdin.write(pixels)
finally:
    writer.stdin.close()
if writer.wait() != 0:
    raise SystemExit('Video encoding failed')
(output / 'results.json').write_text(json.dumps(report, indent=2) + '\n')
(output / 'transcript.txt').write_text((output / 'generated/transcript.txt').read_text())
print(json.dumps({'scenes': len(scenes), 'seconds': sum(s['seconds'] for s in scenes),
    'output': str(output / 'walkthrough.mp4')}))
