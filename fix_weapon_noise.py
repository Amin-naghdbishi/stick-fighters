import re

with open("src/game/audio.ts", "r") as f:
    text = f.read()

# Replace flame_gun / inferno_cannon buffer generation
old_flame_code = """        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1; // White Noise for turbulent flames
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;"""

new_flame_code = """        const noise = this.ctx.createBufferSource();
        if (this.cachedWhiteNoiseBuffer) {
          noise.buffer = this.cachedWhiteNoiseBuffer;
          noise.loop = true;
        }"""

text = text.replace(old_flame_code, new_flame_code)

old_thunder_code = """        const snapBuf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * snapLen), this.ctx.sampleRate);
        const snapData = snapBuf.getChannelData(0);
        for (let i = 0; i < snapBuf.length; i++) {
          snapData[i] = Math.random() * 2 - 1;
        }
        const snap = this.ctx.createBufferSource();
        snap.buffer = snapBuf;"""

new_thunder_code = """        const snap = this.ctx.createBufferSource();
        if (this.cachedWhiteNoiseBuffer) {
          snap.buffer = this.cachedWhiteNoiseBuffer;
          snap.loop = true;
        }"""

text = text.replace(old_thunder_code, new_thunder_code)

with open("src/game/audio.ts", "w") as f:
    f.write(text)
