import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EVENTS, ProfileUpdatedEventDataDto } from '@dexa-wfh/common';
import { loadEnvConfig, parseCorsOrigins } from '@dexa-wfh/config';

const gatewayConfig = loadEnvConfig();

@WebSocketGateway({
  cors: {
    origin: parseCorsOrigins(gatewayConfig.CORS_ORIGIN),
    credentials: true,
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

  broadcastNotification(title: string, message: string, extra?: Record<string, unknown>) {
    if (!this.server) return;
    this.server.emit(EVENTS.ADMIN_NOTIFICATION, {
      id: `evt-${Date.now()}`,
      type: 'info',
      title,
      message,
      timestamp: new Date().toISOString(),
      ...(extra ?? {}),
    });
  }

  broadcastProfileUpdated(data: ProfileUpdatedEventDataDto) {
    const notification = {
      id: `prof-${Date.now()}`,
      type: 'info',
      event: EVENTS.PROFILE_UPDATED,
      title: 'Employee Profile Updated',
      message:
        data.summary ||
        `${data.name} (${data.email}) updated profile: ${(data.changedFields ?? []).join(', ')}`,
      employeeId: data.employeeId,
      email: data.email,
      name: data.name,
      changedFields: data.changedFields ?? [],
      changes: data.changes ?? {},
      timestamp: data.timestamp || new Date().toISOString(),
    };
    if (this.server) {
      this.server.emit(EVENTS.ADMIN_NOTIFICATION, notification);
    }
    return notification;
  }
}
