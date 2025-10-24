import React, { useState, useEffect, useRef } from 'react';
import { Play, Moon, Sun } from 'lucide-react';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';

export default function CodeEditor() {
  const [code, setCode] = useState(`# Write your Python code here
def greet(name):
    return f"Hello, {name}!"

print(greet("World"))`);
  const [output, setOutput] = useState('');
  const [isDark, setIsDark] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState(null);

  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const bindingRef = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    ydocRef.current = new Y.Doc();
    providerRef.current = new WebsocketProvider(
      'ws://localhost:1234', // your WebSocket server
      'monaco-editor-room',
      ydocRef.current
    );

    return () => {
      providerRef.current?.destroy();
      ydocRef.current?.destroy();
    };
  }, []);

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    const yText = ydocRef.current.getText('monaco');

    if (bindingRef.current) bindingRef.current.destroy();

    bindingRef.current = new MonacoBinding(
      yText,
      editor.getModel(),
      new Set([editor]),
      providerRef.current.awareness
    );

    if (yText.length === 0) editor.setValue(code);
    else setCode(yText.toString());
  };

  // Polling function to fetch output by jobId
  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`http://localhost:3001/result/${jobId}`);
        if (res.data.status === 'done') {
          setOutput(res.data.output);
          setIsLoading(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Polling error:', err);
        setOutput('✗ Error fetching result');
        setIsLoading(false);
        clearInterval(interval);
      }
    }, 1000); // poll every 1 second

    return () => clearInterval(interval);
  }, [jobId]);

  const handleRunCode = async () => {
    setIsLoading(true);
    setOutput('🔄 Queued...');

    try {
      const res = await axios.post(
        'http://localhost:3001/run-python',
        { code },
        { headers: { 'Content-Type': 'application/json' } }
      );

      setJobId(res.data.jobId); // Start polling with this jobId
    } catch (err) {
      const errorMessage = err.response
        ? `Status: ${err.response.status}\nError: ${JSON.stringify(err.response.data, null, 2)}`
        : err.message;
      setOutput(`✗ Submission Error:\n${errorMessage}`);
      setIsLoading(false);
      console.error(err);
    }
  };

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-4 py-3 flex items-center justify-between`}>
        <h1 className={`${isDark ? 'text-white' : 'text-gray-900'} text-xl font-semibold`}>Code Editor</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={handleRunCode}
            disabled={isLoading}
            className={`flex items-center gap-2 ${isLoading ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white px-4 py-2 rounded-lg transition-colors font-medium`}
          >
            <Play size={18} />
            {isLoading ? 'Running...' : 'RUN'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex lg:flex-row overflow-hidden">
        <div className={`flex-1 flex flex-col border-b lg:border-b-0 lg:border-r ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'} px-4 py-3 border-b flex items-center justify-between`}>
            <h2 className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-sm font-semibold tracking-wide`}>CODE</h2>
            <span className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-xs`}>{code.length} characters</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              language="python"
              value={code}
              onChange={(value) => setCode(value || '')}
              onMount={handleEditorDidMount}
              theme={isDark ? 'vs-dark' : 'light'}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                wordWrap: 'on',
                tabSize: 4,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                scrollbar: { vertical: 'auto', horizontal: 'hidden', verticalScrollbarSize: 6 },
              }}
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'} px-4 py-3 border-b`}>
            <h2 className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-sm font-semibold tracking-wide`}>OUTPUT</h2>
          </div>
          <div className={`flex-1 ${isDark ? 'bg-gray-950' : 'bg-gray-50'} overflow-auto`}>
            <pre className={`${isDark ? 'text-gray-300' : 'text-gray-800'} p-4 font-mono text-sm whitespace-pre-wrap`}>
              {output || 'Click "RUN" to execute your code...'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
