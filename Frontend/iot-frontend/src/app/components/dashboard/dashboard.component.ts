import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IotService } from '../../services/iot.service';
import { AuthService } from '../../services/auth.service';
import { DeviceStatus, DeviceGroup, DEVICE_TYPES, StoredDevice } from '../../models/device.model';
import {
  applyStatusPayload,
  formatDeviceAckMessage,
  getChatPlaceholder,
  getDefaultDeviceState,
  getDeviceStateSummary,
  parseDeviceCommand,
  shouldSkipChatMessage,
} from '../../models/device-commands';
import { Subscription, finalize, timeout, catchError, of } from 'rxjs';

export interface ChatMessage {
  text: string;
  isOutgoing: boolean;
  timestamp: Date;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  deviceMap = new Map<string, DeviceStatus>();
  messagesMap = new Map<string, ChatMessage[]>();
  groups: DeviceGroup[] = [];
  selectedForGrouping = new Set<string>();
  newGroupName = '';
  selectedDeviceId: string | null = null;
  selectedGroupId: string | null = null;
  selectedDeviceType = DEVICE_TYPES[0].id;
  deviceTypes = DEVICE_TYPES;
  commandInput = '';
  activeCount = 0;
  sending = false;
  draggingOverUngrouped = false;
  editingGroupId: string | null = null;
  tempGroupName = '';
  private timer: any;
  private messagesSub?: Subscription;

  constructor(
    private iotService: IotService,
    private auth: AuthService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  get isAdmin(): boolean {
    return this.auth.isAdmin;
  }

  get currentUser() {
    return this.auth.currentUser();
  }

  logout() {
    this.iotService.disconnect();
    this.auth.logout().subscribe(() => this.auth.redirectToLogin());
  }

  toggleSelection(deviceId: string) {
    if (this.selectedForGrouping.has(deviceId)) {
      this.selectedForGrouping.delete(deviceId);
    } else {
      this.selectedForGrouping.add(deviceId);
    }
  }

  onDragStart(event: DragEvent, deviceId: string) {
    event.dataTransfer?.setData('deviceId', deviceId);
  }

  onDragOver(event: DragEvent, isUngroupedSection = false) {
    event.preventDefault();
    if (isUngroupedSection) {
      this.draggingOverUngrouped = true;
    }
  }

  onDragLeave(event: DragEvent) {
    this.draggingOverUngrouped = false;
  }

  onDragEnd(event: DragEvent) {
    this.draggingOverUngrouped = false;
  }

  onDrop(event: DragEvent, groupId: string) {
    event.preventDefault();
    this.draggingOverUngrouped = false;
    const deviceId = event.dataTransfer?.getData('deviceId');
    if (deviceId) {
      // Remove from any existing group
      this.groups.forEach(g => {
        g.deviceIds = g.deviceIds.filter(id => id !== deviceId);
      });
      
      // Add to new group
      const targetGroup = this.groups.find(g => g.id === groupId);
      if (targetGroup && !targetGroup.deviceIds.includes(deviceId)) {
        targetGroup.deviceIds.push(deviceId);
      }
      
      // Remove empty groups
      this.groups = this.groups.filter(g => g.deviceIds.length > 0);
      
      this.saveGroups();
      this.cdr.detectChanges();
    }
  }

  onDropUngrouped(event: DragEvent) {
    event.preventDefault();
    this.draggingOverUngrouped = false;
    const deviceId = event.dataTransfer?.getData('deviceId');
    if (deviceId) {
      // Remove from any existing group (effectively ungrouping)
      this.groups.forEach(g => {
        g.deviceIds = g.deviceIds.filter(id => id !== deviceId);
      });
      
      // Remove empty groups
      this.groups = this.groups.filter(g => g.deviceIds.length > 0);
      
      this.saveGroups();
      this.cdr.detectChanges();
    }
  }

  createGroup() {
    const name = this.newGroupName.trim();
    if (!name || this.selectedForGrouping.size === 0) return;

    const newGroup: DeviceGroup = {
      id: 'group_' + Date.now(),
      name: name,
      deviceIds: Array.from(this.selectedForGrouping)
    };

    this.groups.push(newGroup);
    this.selectedForGrouping.clear();
    this.newGroupName = '';
    this.saveGroups();
  }

  startEditGroup(event: Event, group: DeviceGroup) {
    event.stopPropagation();
    this.editingGroupId = group.id;
    this.tempGroupName = group.name;
  }

  cancelEditGroup(event: Event) {
    event.stopPropagation();
    this.editingGroupId = null;
    this.tempGroupName = '';
  }

  saveGroupName(event: Event, groupId: string) {
    event.stopPropagation();
    const group = this.groups.find(g => g.id === groupId);
    if (group && this.tempGroupName.trim()) {
      group.name = this.tempGroupName.trim();
      this.saveGroups();
    }
    this.editingGroupId = null;
    this.tempGroupName = '';
  }

  renameGroup(groupId: string, newName: string) {
    const group = this.groups.find(g => g.id === groupId);
    if (group && newName.trim()) {
      group.name = newName.trim();
      this.saveGroups();
    }
  }

  deleteGroup(groupId: string) {
    this.groups = this.groups.filter(g => g.id !== groupId);
    this.saveGroups();
  }

  isDeviceGrouped(deviceId: string): boolean {
    return this.groups.some(g => g.deviceIds.includes(deviceId));
  }

  getUnassignedDevices() {
    return Array.from(this.deviceMap.values()).filter(d => !this.isDeviceGrouped(d.id));
  }

  private saveGroups() {
    localStorage.setItem('iot_device_groups', JSON.stringify(this.groups));
  }

  private loadGroups() {
    const saved = localStorage.getItem('iot_device_groups');
    if (saved) {
      try {
        this.groups = JSON.parse(saved);
      } catch (e) {
        this.groups = [];
      }
    }
  }

  ngOnInit() {
    this.iotService.connect();
    this.loadGroups();
    this.loadDevices();
    this.messagesSub = this.iotService.messages$.subscribe(msg => {
      if (!msg) return;
      const devId = msg.deviceId || (msg.topic && msg.topic.split('/')[2]) || 'unknown';
      
      const currentDevice = this.deviceMap.get(devId);
      const isOfflineMsg = msg.payload === 'OFFLINE';
      const inferredType = currentDevice?.type || this.inferDeviceType(devId);
      const statusUpdate = applyStatusPayload(
        { ...(currentDevice || { id: devId, interval: 60, type: inferredType, lastSeen: new Date(), online: true }), type: inferredType } as DeviceStatus,
        msg.payload || ''
      );

      this.deviceMap.set(devId, {
        ...(currentDevice || this.mapStoredDevice({
          id: devId,
          type: inferredType || 'unknown',
          interval: 60,
          power: 'on',
          ...this.storedDefaults(inferredType || ''),
        })),
        ...statusUpdate,
        type: currentDevice?.type || inferredType,
        interval: currentDevice?.interval ?? statusUpdate.interval ?? 60,
        lastSeen: isOfflineMsg ? null as any : new Date(),
        online: isOfflineMsg ? false : (statusUpdate.online ?? currentDevice?.online ?? true),
      });
      this.deviceMap = new Map(this.deviceMap);

      const isOutgoing = (msg.topic || '').includes('commands');

      if (!shouldSkipChatMessage(msg.payload || '', isOutgoing)) {
        const chatText = isOutgoing
          ? (msg.payload || '')
          : (formatDeviceAckMessage(msg.payload || '') ?? (msg.payload || ''));

        if (chatText) {
          this.appendChatMessage(devId, chatText, isOutgoing);

          this.groups.forEach(group => {
            if (group.deviceIds.includes(devId)) {
              this.appendChatMessage(group.id, `[${devId}] ${chatText}`, isOutgoing);
            }
          });
        }
      }

      this.updateActiveCount();
      this.cdr.detectChanges();
    });
    this.timer = setInterval(() => this.updateActiveCount(), 1000);
  }

  isDeviceOnline(lastSeen?: Date, interval: number = 60): boolean {
    if (!lastSeen) return false;
    const now = new Date().getTime();
    const last = new Date(lastSeen).getTime();
    // Allow for a 20% margin + 2 seconds for network latency
    const threshold = (interval * 1.2 * 1000) + 2000;
    return (now - last) < threshold;
  }

  getDevice(id: string) { return this.deviceMap.get(id); }
  getMessages(id: string) { return this.messagesMap.get(id) || []; }
  
  selectDevice(id: string) { 
    this.selectedDeviceId = id; 
    this.selectedGroupId = null;
  }

  selectGroup(id: string) {
    this.selectedGroupId = id;
    this.selectedDeviceId = null;
  }

  getSelectedGroupDeviceCount(): number {
    const group = this.groups.find(g => g.id === this.selectedGroupId);
    return group ? group.deviceIds.length : 0;
  }

  getSelectedGroupName(): string {
    const group = this.groups.find(g => g.id === this.selectedGroupId);
    return group ? group.name : '';
  }

  get activeDeviceType(): string | undefined {
    return this.selectedDeviceId ? this.getDevice(this.selectedDeviceId)?.type : undefined;
  }

  getDeviceStateSummary(device?: DeviceStatus): string {
    return getDeviceStateSummary(device);
  }

  getChatPlaceholder(): string {
    if (this.selectedGroupId) return 'Broadcast message...';
    return getChatPlaceholder(this.activeDeviceType);
  }

  private appendChatMessage(targetId: string, text: string, isOutgoing: boolean) {
    const currentMessages = this.messagesMap.get(targetId) || [];
    const lastMsg = currentMessages[currentMessages.length - 1];
    if (lastMsg && lastMsg.text === text && isOutgoing === lastMsg.isOutgoing &&
        (new Date().getTime() - lastMsg.timestamp.getTime() < 100)) {
      return;
    }

    this.messagesMap.set(targetId, [
      ...currentMessages,
      { text, isOutgoing, timestamp: new Date() },
    ]);
    this.messagesMap = new Map(this.messagesMap);
  }

  private loadDevices() {
    this.iotService.getDevices().subscribe({
      next: (devices) => {
        devices.forEach(device => {
          this.deviceMap.set(device.id, this.mapStoredDevice(device));
          if (!this.messagesMap.has(device.id)) {
            this.messagesMap.set(device.id, []);
          }
        });
        this.deviceMap = new Map(this.deviceMap);
        this.updateActiveCount();
        this.cdr.detectChanges();
      },
    });
  }

  private storedDefaults(type: string): Partial<StoredDevice> {
    const defaults = getDefaultDeviceState(type);
    return {
      brightness: defaults.brightness,
      speed: defaults.speed,
      temperature: defaults.temperature,
      curtainPosition: defaults.curtainPosition,
    };
  }

  private mapStoredDevice(device: StoredDevice): DeviceStatus {
    return {
      id: device.id,
      type: device.type,
      interval: device.interval,
      brightness: device.brightness,
      speed: device.speed,
      temperature: device.temperature,
      curtainPosition: device.curtainPosition,
      power: device.power === 'off' ? 'off' : 'on',
      online: device.power !== 'off',
      lastSeen: device.power !== 'off' ? new Date() : null as any,
    };
  }

  private applyStoredDevice(device: StoredDevice) {
    this.deviceMap.set(device.id, this.mapStoredDevice(device));
    this.deviceMap = new Map(this.deviceMap);
    this.updateActiveCount();
    this.cdr.detectChanges();
  }

  updateInterval(deviceId: string, seconds: number) {
    const device = this.deviceMap.get(deviceId);
    if (!device) return;

    this.iotService.sendCommand(deviceId, `SET_INTERVAL_${seconds}`).subscribe({
      next: (res) => {
        if (res.device) {
          this.applyStoredDevice(res.device);
        } else {
          device.interval = Number(seconds);
          this.deviceMap = new Map(this.deviceMap);
        }
      },
    });
  }

  addDevice() {
    if (!this.selectedDeviceType) return;

    const id = this.generateDeviceId(this.selectedDeviceType);

    this.iotService.registerDevice(id, this.selectedDeviceType).subscribe({
      next: (res) => {
        const device = this.mapStoredDevice(res.device);
        this.deviceMap.set(device.id, device);
        this.deviceMap = new Map(this.deviceMap);
        if (!this.messagesMap.has(device.id)) this.messagesMap.set(device.id, []);
        this.selectedDeviceId = device.id;
        this.cdr.detectChanges();
      },
    });
  }

  generateDeviceId(type: string): string {
    let index = 1;
    let id = `${type}_${String(index).padStart(2, '0')}`;
    while (this.deviceMap.has(id)) {
      index++;
      id = `${type}_${String(index).padStart(2, '0')}`;
    }
    return id;
  }

  inferDeviceType(deviceId: string): string | undefined {
    const prefix = deviceId.split('_')[0];
    return DEVICE_TYPES.some(t => t.id === prefix) ? prefix : undefined;
  }

  getDeviceTypeLabel(typeOrId?: string): string {
    if (!typeOrId) return 'Device';
    const byType = DEVICE_TYPES.find(t => t.id === typeOrId);
    if (byType) return byType.label;

    const prefix = typeOrId.split('_')[0];
    const byPrefix = DEVICE_TYPES.find(t => t.id === prefix);
    return byPrefix ? byPrefix.label : typeOrId;
  }

  getDeviceDisplayName(device?: DeviceStatus): string {
    if (!device) return '';
    const label = this.getDeviceTypeLabel(device.type || device.id);
    return `${label} (${device.id})`;
  }

  removeDevice(event: Event, id: string) {
    event.stopPropagation();
    this.iotService.deleteDevice(id).subscribe({
      next: () => {
        this.deviceMap.delete(id);
        this.deviceMap = new Map(this.deviceMap);
        this.messagesMap.delete(id);
        if (this.selectedDeviceId === id) this.selectedDeviceId = null;
        
        // Remove from groups if it belongs to any
        this.groups.forEach(group => {
          group.deviceIds = group.deviceIds.filter(devId => devId !== id);
        });
        // Remove empty groups
        this.groups = this.groups.filter(group => group.deviceIds.length > 0);
        this.saveGroups();

        this.updateActiveCount();
        this.cdr.detectChanges();
      }
    });
  }

  sendCurtainCommand(position: 'full' | 'half' | '0') {
    if (!this.selectedDeviceId || this.sending) return;
    this.commandInput = position === '0' ? '0' : position.toUpperCase();
    this.send();
  }

  send() {
    const payload = (this.commandInput || '').trim();
    if ((!this.selectedDeviceId && !this.selectedGroupId) || !payload || this.sending) return;

    if (this.selectedGroupId) {
      this.dispatchCommand(this.selectedGroupId, payload, payload, null);
      return;
    }

    const device = this.getDevice(this.selectedDeviceId!);
    const parsed = parseDeviceCommand(device?.type, payload);
    const mqttPayload = parsed?.mqttPayload ?? payload;
    const displayText = parsed?.displayText ?? payload;

    this.dispatchCommand(this.selectedDeviceId!, displayText, mqttPayload, parsed?.stateUpdate ?? null);
  }

  private dispatchCommand(
    targetId: string,
    displayText: string,
    mqttPayload: string,
    stateUpdate: Partial<DeviceStatus> | null,
  ) {
    this.appendChatMessage(targetId, displayText, true);

    if (stateUpdate && this.deviceMap.has(targetId)) {
      const device = this.deviceMap.get(targetId)!;
      this.deviceMap.set(targetId, { ...device, ...stateUpdate });
      this.deviceMap = new Map(this.deviceMap);
    }

    this.sending = true;
    this.commandInput = '';

    if (this.selectedGroupId) {
      const group = this.groups.find(g => g.id === this.selectedGroupId);
      if (group) {
        const requests = group.deviceIds.map(devId => {
          const dev = this.getDevice(devId);
          const parsed = parseDeviceCommand(dev?.type, mqttPayload);
          const command = parsed?.mqttPayload ?? mqttPayload;
          if (parsed?.stateUpdate && dev) {
            this.deviceMap.set(devId, { ...dev, ...parsed.stateUpdate });
          }
          return this.iotService.sendCommand(devId, command).pipe(
            timeout(5000),
            catchError(() => of(null))
          );
        });
        this.deviceMap = new Map(this.deviceMap);

        import('rxjs').then(({ forkJoin }) => {
          forkJoin(requests).pipe(
            finalize(() => {
              this.ngZone.run(() => {
                this.sending = false;
                this.cdr.detectChanges();
              });
            })
          ).subscribe();
        });
      }
      return;
    }

    this.iotService.sendCommand(targetId, mqttPayload).pipe(
      timeout(5000),
      catchError(() => of(null)),
      finalize(() => {
        this.ngZone.run(() => {
          this.sending = false;
          this.cdr.detectChanges();
        });
      })
    ).subscribe((res) => {
      if (res?.device) {
        this.applyStoredDevice(res.device);
      }
    });
  }

  updateActiveCount() {
    let n = 0;
    this.deviceMap.forEach(d => { if (this.isDeviceOnline(d.lastSeen, d.interval)) n++; });
    this.activeCount = n;
  }

  ngOnDestroy() { 
    if (this.timer) clearInterval(this.timer); 
    if (this.messagesSub) this.messagesSub.unsubscribe();
    this.iotService.disconnect();
  }
}