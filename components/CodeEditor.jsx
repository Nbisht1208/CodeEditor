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

  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const bindingRef = useRef(null);
  const editorRef = useRef(null);

  const API_URL = 'https://unstooping-prolongably-donnell.ngrok-free.dev';

  useEffect(() => {
    ydocRef.current = new Y.Doc();

    providerRef.current = new WebsocketProvider(
      'ws://localhost:1234', // or your deployed WebSocket URL
      'monaco-editor-room',
      ydocRef.current
    );

    return () => {
      providerRef.current?.destroy();
      ydocRef.current?.destroy();
    };
  }, []);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    const yText = ydocRef.current.getText('monaco');

    if (bindingRef.current) {
      bindingRef.current.destroy();
    }

    bindingRef.current = new MonacoBinding(
      yText,
      editor.getModel(),
      new Set([editor]),
      providerRef.current.awareness
    );

    // Ensure initial code is set in editor model if Yjs text is empty
    if (yText.length === 0) {
      editor.setValue(code);
    } else {
      const currentYText = yText.toString();
      if (currentYText !== code) {
        setCode(currentYText);
      }
    }
  };

  const handleRunCode = async () => {
    try {
      setIsLoading(true);
      setOutput('🔄 Executing code...');
      const response = await axios.post(
        'http://localhost:3001/run-python',
        { code },
        { headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' } }
      );

      const executionOutput = response.data.output || JSON.stringify(response.data, null, 2);
      setOutput(executionOutput);
    } catch (error) {
      const errorMessage = error.response
        ? `Status: ${error.response.status}\nError: ${JSON.stringify(error.response.data, null, 2)}`
        : error.message;
      setOutput(`✗ Execution Error:\n${errorMessage}`);
      console.error('API Error:', error);
    } finally {
      setIsLoading(false);
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

export { CodeEditor };
