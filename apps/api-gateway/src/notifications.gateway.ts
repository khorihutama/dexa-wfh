import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EVENTS } from '@dexa-wfh/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    client.emit(EVENTS.ADMIN_NOTIFICATION, {
      id: `conn-${Date.now()}`,
      type: 'info',
      title: 'Real-Time Channel Connected',
      message: 'Connected to Dexa WFH API Gateway via Socket.IO.',
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() payload: Record<string, unknown>) {
    const notification = {
      id: `ping-${Date.now()}`,
      type: 'success',
      title: 'Admin Ping Broadcast',
      message:
        typeof payload?.message === 'string'
          ? payload.message
          : 'Sample real-time toast notification from API Gateway',
      timestamp: new Date().toISOString(),
    };
    this.server.emit(EVENTS.ADMIN_NOTIFICATION, notification);
    return notification;
  }

  broadcastNotification(title: string, message: string) {
    if (!this.server) return;
    this.server.emit(EVENTS.ADMIN_NOTIFICATION, {
      id: `evt-${Date.now()}`,
      type: 'info',
      title,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
