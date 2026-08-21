import {
  BotDifficultyLevel,
  ClientMessage,
  FighterCustomization,
  GameMode,
  PlayerInput,
  RoomState,
  ServerMessage,
} from '../types/game';

export type ConnectionStatus =
  | 'CONNECTED'
  | 'CONNECTING'
  | 'DISCONNECTED'
  | 'RECONNECTING'
  | 'SERVER_UNAVAILABLE';

type MessageCallback = (msg: ServerMessage) => void;
type StatusCallback = (status: ConnectionStatus) => void;
type PingCallback = (ping: number) => void;

export class NetworkClient {
  private ws: WebSocket | null = null;
  private listeners: Set<MessageCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
  private pingListeners: Set<PingCallback> = new Set();

  public myId: string | null = null;
  public sessionToken: string | null = null;
  public currentRoomId: string | null = null;
  public isConnected: boolean = false;
  public connectionStatus: ConnectionStatus = 'DISCONNECTED';
  public ping: number = 0;

  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 12;
  private pendingCustomization: FighterCustomization | null = null;

  constructor() {
    this.connect();
  }

  private setStatus(status: ConnectionStatus) {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.notifyStatus(status);
    }
  }

  private cleanSocket() {
    this.stopPingLoop();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
  }

  private startPingLoop() {
    this.stopPingLoop();
    this.sendPing();
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 2000);
  }

  private stopPingLoop() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'ping', timestamp: Date.now() });
    }
  }

  private getWsUrl(): string {
    let customServerUrl = (import.meta as any).env?.VITE_GAME_SERVER_URL;
    if (customServerUrl && typeof customServerUrl === 'string' && customServerUrl.trim() !== '') {
      customServerUrl = customServerUrl.trim();
      if (customServerUrl.startsWith('http://')) customServerUrl = customServerUrl.replace('http://', 'ws://');
      if (customServerUrl.startsWith('https://')) customServerUrl = customServerUrl.replace('https://', 'wss://');
      return customServerUrl;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.cleanSocket();
    this.setStatus(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');

    try {
      const wsUrl = this.getWsUrl();
      console.log(`[NetworkClient] Connecting to server at ${wsUrl} (Attempt ${this.reconnectAttempts + 1})`);
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.setStatus('CONNECTED');
        console.log('[NetworkClient] Connected cleanly to Stick Fighters server.');

        this.startPingLoop();

        if (this.pendingCustomization) {
          this.send({ type: 'update_customization', customization: this.pendingCustomization });
        }
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;

          if (msg.type === 'pong') {
            const rtt = Math.max(1, Math.round(Date.now() - msg.timestamp));
            this.ping = rtt;
            this.notifyPing(rtt);
            return;
          }

          if (msg.type === 'room_joined') {
            this.myId = msg.yourId;
            this.sessionToken = msg.sessionToken || null;
            this.currentRoomId = msg.room?.roomId || null;
          }
          this.notify(msg);
        } catch (err) {
          console.error('[NetworkClient] Failed to parse server message:', err);
        }
      };

      socket.onclose = (event) => {
        this.isConnected = false;
        this.cleanSocket();

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          this.setStatus('SERVER_UNAVAILABLE');
          console.warn('[NetworkClient] Max reconnection attempts reached. Server unavailable.');
        }
      };

      socket.onerror = () => {
        // Silently handled by onclose
      };
    } catch (err) {
      console.error('[NetworkClient] Connection creation error:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectAttempts++;
    const backoff = Math.min(8000, Math.floor(1000 * Math.pow(1.3, this.reconnectAttempts)));
    this.setStatus('RECONNECTING');

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, backoff);
  }

  public manualReconnect() {
    this.reconnectAttempts = 0;
    this.connect();
  }

  public onMessage(cb: MessageCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public onStatusChange(cb: StatusCallback): () => void {
    this.statusListeners.add(cb);
    cb(this.connectionStatus);
    return () => this.statusListeners.delete(cb);
  }

  public onPing(cb: PingCallback): () => void {
    this.pingListeners.add(cb);
    cb(this.ping);
    return () => this.pingListeners.delete(cb);
  }

  private notify(msg: ServerMessage) {
    for (const cb of this.listeners) {
      cb(msg);
    }
  }

  private notifyStatus(status: ConnectionStatus) {
    for (const cb of this.statusListeners) {
      cb(status);
    }
  }

  private notifyPing(ping: number) {
    for (const cb of this.pingListeners) {
      cb(ping);
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

  public joinRoom(roomId: string, player: FighterCustomization, sessionToken?: string, reconnectId?: string) {
    this.send({
      type: 'join_room',
      roomId,
      player,
      sessionToken: sessionToken || (this.sessionToken || undefined),
      reconnectId: reconnectId || (this.myId || undefined),
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
    this.sessionToken = null;
    this.currentRoomId = null;
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
