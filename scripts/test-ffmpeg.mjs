import { FFmpeg } from '@ffmpeg/ffmpeg';

const ffmpeg = new FFmpeg();
await ffmpeg.load();

const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAHElEQVQI12P4//8/AxJgYGBg+M/AwPCfgQEDAADd+gL5jH7N7wAAAABJRU5ErkJggg==';
const pngBuffer = Buffer.from(pngBase64, 'base64');

for (let i = 0; i < 3; i++) {
  const name = `frame_${String(i).padStart(4, '0')}.png`;
  await ffmpeg.writeFile(name, pngBuffer);
}

try {
  await ffmpeg.exec(['-framerate', '12', '-i', 'frame_%04d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', 'output.mp4']);
  const data = await ffmpeg.readFile('output.mp4');
  console.log('success', data.length);
} catch (error) {
  console.error('ffmpeg error', error);
}
