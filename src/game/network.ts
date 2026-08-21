import {
  BotDifficultyLevel,
  ClientMessage,
  FighterCustomization,
  GameMode,
  PlayerInput,
  RoomState,
  ServerMessage,
} from '../types/game';

type MessageCallback = (msg: ServerMessage) => void;

export class NetworkClient {
  private ws: WebSocket | null = null;
  private listeners: Set<MessageCallback> = new Set();
  public myId: string | null = null;
  public isConnected: boolean = false;
  private reconnectTimer: any = null;
  private pendingCustomization: FighterCustomization | null = null;

  constructor() {
    this.connect();
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      let wsUrl: string;
      const customServerUrl = (import.meta as any).env?.VITE_GAME_SERVER_URL;

      if (customServerUrl && typeof customServerUrl === 'string' && customServerUrl.trim() !== '') {
        wsUrl = customServerUrl.trim();
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/ws`;
      }

      console.log(`Connecting to game server at: ${wsUrl}`);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log('Connected to Stick Fighters game server!');
        if (this.pendingCustomization) {
          this.send({ type: 'update_customization', customization: this.pendingCustomization });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          if (msg.type === 'room_joined') {
            this.myId = msg.yourId;
          }
          this.notify(msg);
        } catch (err) {
          console.error('Failed to parse incoming server message:', err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        console.warn('Disconnected from game server. Reconnecting in 2s...');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket connection error:', err);
      };
    } catch (err) {
      console.error('Failed to initialize WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 2500);
  }

  public onMessage(cb: MessageCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(msg: ServerMessage) {
    for (const cb of this.listeners) {
      cb(msg);
    }
  }

  public send(msg: ClientMessage) {
    if (msg.type === 'update_customization') {
      this.pendingCustomization = msg.customization;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public createRoom(
    player: FighterCustomization,
    mode: GameMode,
    mapId: string,
    fillWithBots: boolean,
    maxPlayers: number,
    botCount?: number,
    roomName?: string,
    matchDuration?: number,
    duelRoundsTotal?: number,
    botDifficulty?: BotDifficultyLevel
  ) {
    this.send({
      type: 'create_room',
      player,
      mode,
      mapId,
      fillWithBots,
      maxPlayers,
      botCount,
      roomName,
      matchDuration,
      duelRoundsTotal,
      botDifficulty,
    });
  }

  public updateRoomSettings(settings: {
    mapId?: string;
    mode?: GameMode;
    fillWithBots?: boolean;
    botCount?: number;
    botDifficulty?: BotDifficultyLevel;
    maxPlayers?: number;
    matchDuration?: number;
    duelRoundsTotal?: number;
  }) {
    this.send({
      type: 'update_room_settings',
      ...settings,
    });
  }

  public joinRoom(roomId: string, player: FighterCustomization) {
    this.send({
      type: 'join_room',
      roomId,
      player,
    });
  }

  public quickMatch(player: FighterCustomization, mode: GameMode) {
    this.send({
      type: 'quick_match',
      player,
      mode,
    });
  }

  public sendInput(input: PlayerInput) {
    this.send({
      type: 'input',
      input,
    });
  }

  public setReady(isReady: boolean) {
    this.send({
      type: 'set_ready',
      isReady,
    });
  }

  public startGame() {
    this.send({
      type: 'start_game',
    });
  }

  public restartMatch() {
    this.send({
      type: 'restart_match',
    });
  }

  public returnToLobby() {
    this.send({
      type: 'return_to_lobby',
    });
  }

  public leaveRoom() {
    this.send({
      type: 'leave_room',
    });
  }

  public sendChat(message: string) {
    this.send({
      type: 'chat',
      message,
    });
  }
}

export const network = new NetworkClient();
