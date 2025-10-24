import express from 'express';
import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';
import os from 'os';
import cors from 'cors';

const docker = new Docker();
const app = express();

app.use(cors({
    origin: 'http://localhost:5173'  // Allow only your React app origin
}));
// Enable CORS for cross-origin requests
app.use(express.json({ limit: '1mb' })); // Built-in JSON parser

// Endpoint to run Python code
app.post('/run-python', async (req, res) => {
    const code = req.body.code;
    if (!code) return res.status(400).send('No code provided');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesandbox-'));
    const scriptPath = path.join(tempDir, 'script.py');

    fs.writeFileSync(scriptPath, code);

    try {
        const container = await docker.createContainer({
            Image: 'python:3.11-slim',
            Cmd: ['python', '/code/script.py'],
            HostConfig: {
                Binds: [`${scriptPath}:/code/script.py:ro`],
                NetworkMode: 'none',
                Memory: 128 * 1024 * 1024, // 128 MB
                CpuQuota: 50000, // CPU limit
                PidsLimit: 64,
                AutoRemove: true,
            },
            User: '1000:1000',
            Tty: false,
        });

        await container.start();

        const status = await container.wait({ timeout: 5000 });
        const output = await container.logs({ stdout: true, stderr: true });
        const outputStr = output.toString('utf-8').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        res.send({ output: outputStr });


    } catch (err) {
        console.error(err);
        res.status(500).send({ error: err.message || 'Execution error' });

    } finally {
        fs.unlinkSync(scriptPath);
        fs.rmdirSync(tempDir);
    }
});

const port = 3001;
app.listen(port, () => {
    console.log(`Backend API listening at http://localhost:${port}`);
});
