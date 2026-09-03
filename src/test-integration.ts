import { spawn } from 'child_process';
import { config } from 'dotenv';

// Load environment variables for credentials
config();

async function runTest() {
  console.log('🚀 Starting Rumble MCP Integration Test...');

  const server = spawn('node', ['dist/index.js'], {
    env: process.env,
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  let requestId = 1;

  async function callTool(name: string, args: Record<string, unknown> = {}) {
    return new Promise((resolve, reject) => {
      const id = requestId++;
      const request =
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name, arguments: args },
          id,
        }) + '\n';

      console.log(`\nTesting tool: ${name}...`);

      let responseData = '';

      const onData = (data: Buffer) => {
        responseData += data.toString();
        const lines = responseData.split('\n');
        responseData = lines.pop() ?? ''; // keep incomplete trailing line
        for (const line of lines) {
          if (!line.trim()) continue;
          let parsed: unknown;
          try {
            parsed = JSON.parse(line);
          } catch {
            // MCP servers log to stderr; any non-JSON stdout line is worth surfacing
            console.error(`[test-integration] non-JSON stdout line: ${line.slice(0, 120)}`);
            continue;
          }
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'id' in parsed &&
            (parsed as { id: unknown }).id === id
          ) {
            cleanup();
            const response = parsed as {
              id: number;
              error?: unknown;
              result?: { isError?: boolean; content?: Array<{ text?: string }> };
            };
            if (response.error) {
              reject(new Error(`Tool ${name} failed: ${JSON.stringify(response.error)}`));
            } else if (response.result?.isError) {
              // MCP tool errors arrive as result.isError, not as protocol errors
              reject(
                new Error(`Tool ${name} returned an error: ${response.result.content?.[0]?.text}`)
              );
            } else {
              console.log(`✅ Tool ${name} passed!`);
              resolve(response.result);
            }
            return;
          }
        }
      };

      const cleanup = () => {
        clearTimeout(deadline);
        server.stdout.removeListener('data', onData);
        server.removeListener('exit', onExit);
      };
      const onExit = (code: number) => {
        cleanup();
        reject(new Error(`Server exited before responding (exit code ${code})`));
      };
      // Deadline so a hung server fails the test instead of hanging it forever
      const deadline = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out waiting for a response'));
      }, 60_000);

      server.stdout.on('data', onData);
      server.once('exit', onExit);
      server.stdin.write(request);
    });
  }

  async function listTools() {
    return new Promise((resolve, reject) => {
      const id = requestId++;
      const request = JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id }) + '\n';

      console.log('\nTesting tool listing...');

      let responseData = '';

      const onData = (data: Buffer) => {
        responseData += data.toString();
        const lines = responseData.split('\n');
        responseData = lines.pop() ?? ''; // keep incomplete trailing line
        for (const line of lines) {
          if (!line.trim()) continue;
          let parsed: unknown;
          try {
            parsed = JSON.parse(line);
          } catch {
            // MCP servers log to stderr; any non-JSON stdout line is worth surfacing
            console.error(`[test-integration] non-JSON stdout line: ${line.slice(0, 120)}`);
            continue;
          }
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'id' in parsed &&
            (parsed as { id: unknown }).id === id
          ) {
            cleanup();
            const response = parsed as {
              id: number;
              error?: unknown;
              result?: { tools?: unknown[] };
            };
            if (response.error) {
              reject(new Error(`Tool listing failed: ${JSON.stringify(response.error)}`));
            } else {
              const tools = response.result?.tools;
              if (Array.isArray(tools) && tools.length > 0) {
                console.log(`✅ Tool listing passed! (${tools.length} tools available)`);
                resolve(tools);
              } else {
                reject(new Error('Tool listing returned no tools'));
              }
            }
            return;
          }
        }
      };

      const cleanup = () => {
        clearTimeout(deadline);
        server.stdout.removeListener('data', onData);
        server.removeListener('exit', onExit);
      };
      const onExit = (code: number) => {
        cleanup();
        reject(new Error(`Server exited before responding (exit code ${code})`));
      };
      // Deadline so a hung server fails the test instead of hanging it forever
      const deadline = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out waiting for a response'));
      }, 60_000);

      server.stdout.on('data', onData);
      server.once('exit', onExit);
      server.stdin.write(request);
    });
  }

  try {
    // 1. List tools
    await listTools();

    // 2. Test core tools
    await callTool('get_fundamental_calls', { limit: 1 });
    await callTool('get_technical_calls', { limit: 1 });
    await callTool('list_known_portfolios');

    console.log('\n✨ All core tools verified successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    server.kill();
  }
}

runTest();
