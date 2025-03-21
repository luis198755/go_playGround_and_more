import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar/Navbar';
import { Tabs } from './components/Editor/Tabs';
import Editor from '@monaco-editor/react';
import { Play, Share2, HelpCircle, Terminal as TerminalIcon, Download, Copy, FileX, Menu as MenuIcon, X as XIcon, FolderInput } from 'lucide-react';
import { TerminalOutput } from './components/Terminal/TerminalOutput';
import { EditorSettings } from './components/Editor/EditorSettings';
import { UserManual } from './components/UserManual/UserManual';
import goExamples from './codes/examples_go.json';
import jsonExamples from './codes/examples_json.json';
import { EditorSettings as EditorSettingsType, Tab, EditorMode } from './types';

function App() {
  const [mode, setMode] = useState<EditorMode>('go');
  const [isManualVisible, setIsManualVisible] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tabs, setTabs] = useState<Tab[]>([{
    id: 'hello-world',
    title: 'hello-world.go',
    code: goExamples['hello-world'].code,
    isExample: true,
    exampleKey: 'hello-world'
  }]);
  
  const [activeTabId, setActiveTabId] = useState('hello-world');
  const [selectedExample, setSelectedExample] = useState('hello-world');

  const [editorSettings, setEditorSettings] = useState<EditorSettingsType>({
    fontSize: 14,
    theme: 'vs-dark',
    minimap: false,
    wordWrap: 'on',
    isSettingsOpen: false,
  });

  // Get current examples based on mode
  const getCurrentExamples = () => mode === 'go' ? goExamples : jsonExamples;

  // Handle mode changes and update active tab
  const handleModeChange = (newMode: EditorMode) => {
    setMode(newMode);
    const examples = newMode === 'go' ? goExamples : jsonExamples;
    const firstExample = Object.keys(examples)[0];
    const newTab = {
      id: firstExample,
      title: `${firstExample}.${newMode === 'go' ? 'go' : 'json'}`,
      code: examples[firstExample].code,
      isExample: true,
      exampleKey: firstExample
    };
    
    setTabs([newTab]);
    setActiveTabId(firstExample);
    setSelectedExample(firstExample);
    setOutput('');
  };

  useEffect(() => {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (activeTab) {
      setSelectedExample(activeTab.exampleKey || 'user-code');
    }
  }, [activeTabId, tabs]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const settingsMenu = document.querySelector('[role="menu"]');
      const settingsButton = document.querySelector('[aria-haspopup="true"]');
      const target = event.target as HTMLElement;
      
      if (settingsMenu && settingsButton && 
          !settingsMenu.contains(target) && 
          !settingsButton.contains(target)) {
        const isFormElement = target.closest('select, input, option');
        if (!isFormElement) {
          setEditorSettings(prev => ({ ...prev, isSettingsOpen: false }));
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNewTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab: Tab = {
      id: newId,
      title: mode === 'json' ? 'untitled.json' : 'untitled.go',
      code: mode === 'json' ? '{\n  \n}' : 'package main\n\nfunc main() {\n\t\n}',
      isExample: false
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    setSelectedExample('user-code');
  };

  const handleCloseTab = (tabId: string) => {
    // Don't close if it's the last tab
    if (tabs.length === 1) {
      return;
    }

    // Find the tab to close
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) return;

    // If closing the active tab, determine the next tab to activate
    if (activeTabId === tabId) {
      const nextTab = tabs[tabIndex + 1] || tabs[tabIndex - 1];
      setActiveTabId(nextTab.id);
      setSelectedExample(nextTab.exampleKey || 'user-code');
    }

    // Remove the tab
    setTabs(prev => prev.filter(tab => tab.id !== tabId));
  };

  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || '';
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId ? { ...tab, code: newCode } : tab
    ));

    if (mode === 'json') {
      try {
        JSON.parse(newCode);
        setOutput('Valid JSON');
      } catch (error) {
        setOutput(error instanceof Error ? error.message : 'Invalid JSON');
      }
    }
  };

  const handleExampleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newExample = event.target.value;
    if (newExample === 'user-code') {
      handleNewTab();
    } else {
      const examples = getCurrentExamples();
      const newId = `tab-${Date.now()}`;
      const exampleTab = {
        id: newId,
        title: `${newExample}.${mode}`,
        code: examples[newExample].code,
        isExample: true,
        exampleKey: newExample
      };
      setTabs(prev => [...prev, exampleTab]);
      setActiveTabId(newId);
      setSelectedExample(newExample);
    }
    setOutput('');
  };

  const handleRunCode = async () => {
    if (mode === 'json') {
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      if (!activeTab) return;
      
      try {
        const formatted = JSON.stringify(JSON.parse(activeTab.code), null, 2);
        setTabs(prev => prev.map(tab => 
          tab.id === activeTabId ? { ...tab, code: formatted } : tab
        ));
        setOutput('JSON formatted successfully');
      } catch (error) {
        setOutput(error instanceof Error ? error.message : 'Invalid JSON');
      }
      return;
    }

    setIsLoading(true);
    setOutput('');
    try {
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      if (!activeTab) return;

      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: activeTab.code }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported in this browser.');
      }
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          setOutput(prev => prev + chunk);
        }
      }
    } catch (error) {
      setOutput(`Failed to execute code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (!activeTab) return;
    navigator.clipboard.writeText(activeTab.code);
  };

  const handleShareOnX = () => {
    const text = 'Check out my Code Playground! 🚀\n';
    const url = window.location.href;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(shareUrl, '_blank', 'width=550,height=420');
  };

  const handleDownloadCode = () => {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (!activeTab) return;
    const blob = new Blob([activeTab.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab.title;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    // Check if file type matches current mode
    if ((mode === 'go' && fileExtension !== 'go') || 
        (mode === 'json' && fileExtension !== 'json')) {
      setOutput(`Error: Please import a ${mode.toUpperCase()} file in ${mode.toUpperCase()} mode`);
      return;
    }

    try {
      const content = await file.text();
      const newId = `tab-${Date.now()}`;
      const newTab: Tab = {
        id: newId,
        title: file.name,
        code: content,
        isExample: false
      };
      
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newId);
      setSelectedExample('user-code');
      setOutput(`Successfully imported ${file.name}`);
    } catch (error) {
      setOutput(`Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const examples = getCurrentExamples();

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-white">
      <Navbar mode={mode} onModeChange={handleModeChange} />
      <div className="container mx-auto p-4 pt-6">
        <div className="bg-[#2d2d2d] rounded-lg overflow-hidden flex flex-col">
          <div className="flex flex-col md:flex-row flex-1 gap-4">
            {/* Editor Section */}
            <div className="w-full md:w-1/2 p-2 flex flex-col">
              <div className="flex flex-col space-y-2 mb-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-400 font-medium">
                    {mode === 'json' ? 'JSON Viewer' : 'Code Editor'}
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="hidden sm:flex items-center space-x-1 border-r border-gray-700 pr-2 mr-1">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 rounded hover:bg-[#3d3d3d] text-gray-400 hover:text-white transition-colors"
                        title="Import File"
                      >
                        <FolderInput size={16} />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={mode === 'go' ? '.go' : '.json'}
                        onChange={handleFileImport}
                        className="hidden"
                      />
                      <button 
                        onClick={handleCopyCode}
                        className="p-1.5 rounded hover:bg-[#3d3d3d] text-gray-400 hover:text-white transition-colors"
                        title="Copy Code"
                      >
                        <Copy size={16} />
                      </button>
                      <button 
                        onClick={handleDownloadCode}
                        className="p-1.5 rounded hover:bg-[#3d3d3d] text-gray-400 hover:text-white transition-colors"
                        title="Download Code"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                    <div className="hidden sm:flex items-center space-x-1">
                      <button 
                        onClick={() => {
                          handleNewTab();
                          setOutput('');
                        }}
                        className="p-1.5 rounded hover:bg-[#3d3d3d] text-gray-400 hover:text-white transition-colors"
                        title="Clear Code and Terminal"
                      >
                        <FileX size={16} />
                      </button>
                      <EditorSettings 
                        settings={editorSettings}
                        onSettingsChange={setEditorSettings}
                      />
                    </div>
                  </div>
                </div>
                <div className="sm:hidden flex items-center justify-between">
                  <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 rounded hover:bg-[#0066aa] text-[#007acc] hover:text-white transition-colors"
                  >
                    {isMobileMenuOpen ? <XIcon size={20} /> : <MenuIcon size={20} />}
                  </button>

                  <div className="flex justify-end">
                    <EditorSettings
                      settings={editorSettings}
                      onSettingsChange={setEditorSettings}
                    />
                  </div>

                  {/* Mobile Menu */}
                  {isMobileMenuOpen && (
                    <div className="absolute right-4 mt-2 w-48 rounded-md shadow-lg bg-[#2d2d2d] ring-1 ring-black ring-opacity-5 z-50">
                      <div className="py-1" role="menu" aria-orientation="vertical">
                        <button
                          onClick={() => {
                            fileInputRef.current?.click();
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-[#3d3d3d] flex items-center space-x-2"
                        >
                          <FolderInput size={14} />
                          <span>Import File</span>
                        </button>
                        <button
                          onClick={() => {
                            handleCopyCode();
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-[#3d3d3d] flex items-center space-x-2"
                        >
                          <Copy size={14} />
                          <span>Copy</span>
                        </button>
                        <button
                          onClick={() => {
                            handleDownloadCode();
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-[#3d3d3d] flex items-center space-x-2"
                        >
                          <Download size={14} />
                          <span>Download</span>
                        </button>
                        <button
                          onClick={() => {
                            handleNewTab();
                            setOutput('');
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-[#3d3d3d] flex items-center space-x-2"
                        >
                          <FileX size={14} />
                          <span>Clear All</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <Tabs
                tabs={tabs}
                activeTabId={activeTabId}
                onTabChange={setActiveTabId}
                onTabClose={handleCloseTab}
                onNewTab={handleNewTab}
              />
              <div className="h-[calc(100vh-24rem)]">
                <Editor
                  height="100%"
                  defaultLanguage={mode === 'json' ? 'json' : 'go'}
                  theme={editorSettings.theme}
                  value={tabs.find(tab => tab.id === activeTabId)?.code || ''}
                  onChange={handleCodeChange}
                  options={{
                    minimap: { enabled: editorSettings.minimap },
                    fontSize: editorSettings.fontSize,
                    scrollBeyondLastLine: false,
                    lineNumbers: 'on',
                    roundedSelection: false,
                    automaticLayout: true,
                    wordWrap: editorSettings.wordWrap,
                    formatOnPaste: true,
                    formatOnType: true,
                  }}
                />
              </div>
            </div>

            {/* Mobile Controls - Shows between editor and terminal on mobile */}
            <div className="md:hidden bg-[#2d2d2d] p-4 flex flex-col gap-4 border-y border-gray-700">
              <div className="w-full">
                <select 
                  className="bg-[#1e1e1e] text-white px-4 py-2 rounded border border-gray-700 w-full text-sm"
                  value={selectedExample}
                  onChange={handleExampleChange}
                >
                  <option value="user-code">User Code</option>
                  {Object.entries(examples).map(([key, example]) => (
                    <option key={key} value={key}>
                      {example.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                <button
                  onClick={handleRunCode}
                  disabled={isLoading}
                  className={`px-4 py-2 rounded flex items-center gap-2 justify-center text-sm font-medium transition-colors ${
                    isLoading 
                      ? 'bg-gray-600 cursor-not-allowed' 
                      : 'bg-[#007acc] hover:bg-[#0066aa]'
                  }`}
                >
                  <Play size={16} />
                  {isLoading ? 'Running...' : mode === 'json' ? 'Format JSON' : 'Run'}
                </button>
                
                <button 
                  onClick={handleShareOnX}
                  className="px-4 py-2 rounded border border-gray-700 hover:bg-gray-700 flex items-center gap-2 justify-center text-sm font-medium transition-colors"
                  title="Share on X (Twitter)"
                >
                  <Share2 size={16} />
                  Share on X
                </button>
                
                <button 
                  onClick={() => setIsManualVisible(!isManualVisible)}
                  className={`px-4 py-2 rounded border border-gray-700 hover:bg-gray-700 flex items-center gap-2 justify-center text-sm font-medium transition-colors ${isManualVisible ? 'bg-gray-700' : ''}`}
                  title="Toggle User Manual"
                >
                  <HelpCircle size={16} />
                  {isManualVisible ? 'Hide Manual' : 'Show Manual'}
                </button>
              </div>
            </div>

            {/* Terminal Output Section */}
            <div className="w-full md:w-1/2 p-2 flex flex-col">
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <TerminalIcon size={14} className="text-[#007acc]" />
                <span>{mode === 'json' ? 'JSON Validation' : 'Terminal Output'}</span>
              </div>
              <TerminalOutput 
                output={output} 
                isLoading={isLoading} 
                onClear={() => setOutput('')}
              />
            </div>
          </div>

          {/* Desktop Control Bar - Hidden on mobile */}
          <div className="hidden md:flex bg-[#2d2d2d] p-4 flex-col gap-4 border-t border-gray-700">
            <div className="w-full">
              <select 
                className="bg-[#1e1e1e] text-white px-4 py-2 rounded border border-gray-700 w-full text-sm"
                value={selectedExample}
                onChange={handleExampleChange}
              >
                <option value="user-code">User Code</option>
                {Object.entries(examples).map(([key, example]) => (
                  <option key={key} value={key}>
                    {example.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
              <button
                onClick={handleRunCode}
                disabled={isLoading}
                className={`px-4 py-2 rounded flex items-center gap-2 justify-center text-sm font-medium transition-colors ${
                  isLoading 
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : 'bg-[#007acc] hover:bg-[#0066aa]'
                }`}
              >
                <Play size={16} />
                {isLoading ? 'Running...' : mode === 'json' ? 'Format JSON' : 'Run'}
              </button>
              
              <button 
                onClick={handleShareOnX}
                className="px-4 py-2 rounded border border-gray-700 hover:bg-gray-700 flex items-center gap-2 justify-center text-sm font-medium transition-colors"
                title="Share on X (Twitter)"
              >
                <Share2 size={16} />
                Share on X
              </button>
              
              <button 
                onClick={() => setIsManualVisible(!isManualVisible)}
                className={`px-4 py-2 rounded border border-gray-700 hover:bg-gray-700 flex items-center gap-2 justify-center text-sm font-medium transition-colors ${isManualVisible ? 'bg-gray-700' : ''}`}
                title="Toggle User Manual"
              >
                <HelpCircle size={16} />
                {isManualVisible ? 'Hide Manual' : 'Show Manual'}
              </button>
            </div>
          </div>
        </div>

        <UserManual isVisible={isManualVisible} />
      </div>
    </div>
  );
}

export default App;