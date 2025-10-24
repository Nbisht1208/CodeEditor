import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { redisClient } from './redisClient.js';

const docker = new Docker();

async function runWorker() {
    console.log('🔒 Worker started and waiting for jobs...');

    while (true) {
        try {
            const jobData = await redisClient.rPop('jobQueue');
            if (!jobData) {
                await new Promise(r => setTimeout(r, 500)); // Sleep if no jobs
                continue;
            }

            let job;
            try {
                job = JSON.parse(jobData);
            } catch {
                console.error('⚠️ Invalid job data:', jobData);
                continue;
            }

            const { jobId, code } = job;
            console.log(`📦 Picked job ${jobId}`);

            // Create temporary folder & script
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesandbox-'));
            const scriptPath = path.join(tempDir, 'script.py');
            fs.writeFileSync(scriptPath, code);

            try {
                const container = await docker.createContainer({
                    Image: 'python:3.11-slim',
                    Cmd: ['python', '/code/script.py'],
                    HostConfig: {
                        Binds: [`${scriptPath}:/code/script.py:ro`],
                        NetworkMode: 'none',            // No network
                        Memory: 128 * 1024 * 1024,      // 128 MB memory
                        CpuQuota: 50000,                 // CPU limit
                        PidsLimit: 32,                   // Limit processes
                        AutoRemove: true,
                        SecurityOpt: ['no-new-privileges'], // Drop privileges
                        CapDrop: ['ALL'],                // Remove all capabilities
                    },
                    User: '1000:1000',                  // Non-root user
                    Tty: false,
                });

                await container.start();

                try {
                    await container.wait({ timeout: 5000 }); // Timeout 5s
                } catch {
                    await container.kill();
                    await redisClient.set(`result:${jobId}`, '⏰ Execution timed out', { EX: 300 });
                    console.log(`⏰ Job ${jobId} timed out`);
                    continue;
                }

                const output = await container.logs({ stdout: true, stderr: true });
                const outputStr = output.toString('utf-8').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
                await redisClient.set(`result:${jobId}`, outputStr, { EX: 300 });
                console.log(`✅ Job ${jobId} done`);

            } catch (err) {
                await redisClient.set(`result:${jobId}`, `❌ Error: ${err.message}`, { EX: 300 });
                console.error(`❌ Job ${jobId} error:`, err.message);

            } finally {
                fs.unlinkSync(scriptPath);
                fs.rmSync(tempDir, { recursive: true, force: true });
            }

        } catch (err) {
            console.error('Worker loop error:', err.message);
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

// Run worker
runWorker().catch(err => console.error('Worker failed to start:', err));
