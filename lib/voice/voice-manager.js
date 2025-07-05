// lib/voice/voice-manager.js
// V3 Voice Manager - Local speech synthesis using mlx-audio for M3 MacBook

const EventEmitter = require('events');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);

class VoiceManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      voice: options.voice || 'af_heart',
      speed: options.speed || 1.0,
      outputDir: options.outputDir || path.join(os.homedir(), '.mlx_audio/outputs'),
      ...options
    };

    this.isListening = false;
    this.mlxInstalled = null;
    this.execAsync = execAsync; // Make it available to tests
    this.checkMLXInstallation();
  }

  /**
   * Check if mlx-audio is installed
   */
  async checkMLXInstallation() {
    return new Promise((resolve) => {
      exec('which mlx_audio.tts.generate', (error) => {
        this.mlxInstalled = !error;
        if (!this.mlxInstalled) {
          this.emit('warning', 'mlx-audio not installed. Run: pip install mlx-audio');
        }
        resolve(this.mlxInstalled);
      });
    });
  }

  /**
   * Generate speech from text using mlx-audio
   */
  async speak(text, options = {}) {
    if (!text || text.trim() === '') {
      throw new Error('No text provided for speech synthesis');
    }

    if (!this.mlxInstalled) {
      await this.checkMLXInstallation();
      if (!this.mlxInstalled) {
        throw new Error('mlx-audio not installed. Please run: pip install mlx-audio');
      }
    }

    const voice = options.voice || this.options.voice;
    const speed = options.speed || this.options.speed;
    const filePrefix = options.filePrefix || `calmhive_${Date.now()}`;

    return new Promise((resolve, reject) => {
      const args = [
        '-m', 'mlx_audio.tts.generate',
        '--text', text,
        '--voice', voice,
        '--speed', speed.toString(),
        '--file_prefix', filePrefix
      ];

      const pythonProcess = spawn('python', args, {
        cwd: this.options.outputDir
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`TTS generation failed: ${errorOutput}`));
        } else {
          const audioFile = path.join(this.options.outputDir, `${filePrefix}.wav`);
          this.emit('speech-complete', {
            text,
            file: audioFile,
            voice,
            speed
          });

          // Auto-play if requested
          if (options.autoPlay) {
            this.playAudio(audioFile);
          }

          resolve(audioFile);
        }
      });
    });
  }

  /**
   * Play audio file using system player
   */
  async playAudio(audioFile) {
    return new Promise((resolve, reject) => {
      // Use afplay on macOS
      exec(`afplay "${audioFile}"`, (error) => {
        if (error) {
          reject(error);
        } else {
          this.emit('playback-complete', audioFile);
          resolve();
        }
      });
    });
  }

  /**
   * Process voice command and convert to calmhive command
   */
  analyzeCommand(transcript) {
    const lowerText = transcript.toLowerCase();

    // Command patterns
    const patterns = {
      afk: /(?:run|start|execute|do)\s+(?:in\s+)?(?:background|afk)|afk\s+(?:mode|task)?/i,
      fix: /fix(?:ing)?\s+(?:the\s+)?|repair|debug|solve|resolve/i,
      do: /(?:please\s+)?(?:do|perform|execute|complete|handle)\s+/i,
      search: /(?:search|find|look\s+for|locate)\s+/i,
      help: /(?:help|what\s+can\s+you\s+do|how\s+do\s+i)/i,
      stop: /(?:stop|cancel|abort|quit|exit)/i,
      status: /(?:status|what'?s\s+happening|progress|update)/i,
      think: /(?:think|analyze|consider|evaluate)\s+(?:about\s+)?/i,
      tui: /(?:show|open|launch)\s+(?:the\s+)?(?:interface|tui|ui)/i
    };

    // Determine command type
    let commandType = 'do'; // default
    let commandText = transcript;

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(lowerText)) {
        commandType = type;
        commandText = transcript.replace(pattern, '').trim();
        break;
      }
    }

    return {
      type: commandType,
      text: commandText,
      original: transcript
    };
  }

  /**
   * Convert text to speech and execute as command
   */
  async executeVoiceCommand(transcript) {
    const command = this.analyzeCommand(transcript);

    // Generate acknowledgment
    const ackText = this.getAcknowledgment(command);
    await this.speak(ackText, { autoPlay: true });

    // Build command line
    let cmdLine = '';
    switch (command.type) {
    case 'afk':
      cmdLine = `calmhive afk start "${command.text}"`;
      break;
    case 'fix':
      cmdLine = `calmhive fix "${command.text}"`;
      break;
    case 'do':
      cmdLine = `calmhive do "${command.text}"`;
      break;
    case 'search':
      cmdLine = `calmhive search "${command.text}"`;
      break;
    case 'status':
      cmdLine = 'calmhive afk status';
      break;
    case 'tui':
      cmdLine = 'calmhive tui';
      break;
    case 'help':
      cmdLine = 'calmhive help';
      break;
    default:
      cmdLine = `calmhive do "${command.text}"`;
    }

    this.emit('command-execute', {
      command: command,
      cmdLine: cmdLine
    });

    return cmdLine;
  }

  /**
   * Get acknowledgment text for command
   */
  getAcknowledgment(command) {
    const acks = {
      afk: [
        'Starting background task',
        'Running in AFk mode',
        'Processing in background'
      ],
      fix: [
        'Looking into the issue',
        'Analyzing the problem',
        'Working on a fix'
      ],
      do: [
        'Working on it',
        'Processing your request',
        'Getting that done'
      ],
      status: [
        'Checking status',
        'Getting current progress',
        'Retrieving status'
      ]
    };

    const options = acks[command.type] || ['Processing'];
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * List available voices
   */
  getAvailableVoices() {
    return [
      { id: 'af_heart', name: 'AF Heart', gender: 'female' },
      { id: 'af_nova', name: 'AF Nova', gender: 'female' },
      { id: 'af_bella', name: 'AF Bella', gender: 'female' },
      { id: 'bf_emma', name: 'BF Emma', gender: 'female' },
      { id: 'am_adam', name: 'AM Adam', gender: 'male' },
      { id: 'bm_george', name: 'BM George', gender: 'male' }
    ];
  }

  /**
   * Test voice setup
   */
  async testVoiceSetup() {
    try {
      await this.speak('Calmhive voice system initialized', {
        autoPlay: true
      });

      return {
        tts: true,
        status: 'Voice system ready (mlx-audio)'
      };
    } catch (error) {
      return {
        tts: false,
        status: 'Voice system not available',
        error: error.message
      };
    }
  }

  /**
   * Start listening with RealtimeSTT (if available)
   * Falls back to warning if not installed
   */
  async startListening() {
    try {
      // Check if RealtimeSTT is available (from V1)
      const { spawn } = require('child_process');
      const checkSTT = spawn('python3', ['-c', 'import RealtimeSTT']);

      await new Promise((resolve, reject) => {
        checkSTT.on('close', (code) => {
          if (code === 0) {
            this.emit('info', 'RealtimeSTT available - use voice start command');
            resolve();
          } else {
            reject(new Error('RealtimeSTT not installed'));
          }
        });
      });

      this.isListening = true;
      this.emit('listening-start');
    } catch (error) {
      this.emit('warning', 'RealtimeSTT not installed. Install with: pip install RealtimeSTT');
      this.isListening = false;
    }
  }

  /**
   * Stop listening
   */
  stopListening() {
    this.isListening = false;
    this.emit('listening-stop');
  }

  /**
   * Get conversation history (V1 compatibility)
   */
  async getConversationHistory() {
    const conversationDir = path.join(os.homedir(), '.claude/calmhive/lib/voice/consolidated/output');
    try {
      const files = await fs.readdir(conversationDir);
      return files.filter(f => f.endsWith('.yml'));
    } catch (error) {
      return [];
    }
  }

  /**
   * Resume conversation (V1 compatibility)
   */
  async resumeConversation(conversationId) {
    const conversationPath = path.join(
      os.homedir(),
      '.claude/calmhive/lib/voice/consolidated/output',
      `${conversationId}.yml`
    );

    try {
      const content = await fs.readFile(conversationPath, 'utf8');
      this.emit('conversation-loaded', { id: conversationId, content });
      return content;
    } catch (error) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
  }
}

module.exports = VoiceManager;
