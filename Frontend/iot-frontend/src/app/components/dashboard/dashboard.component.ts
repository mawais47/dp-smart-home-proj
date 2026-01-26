import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IotService } from '../../services/iot.service';
import { DeviceStatus, DeviceGroup } from '../../models/device.model';
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
  newDeviceId = '';
  commandInput = '';
  activeCount = 0;
  sending = false;
  draggingOverUngrouped = false;
  editingGroupId: string | null = null;
  tempGroupName = '';
  private timer: any;
  private messagesSub?: Subscription;

  constructor(private iotService: IotService, private ngZone: NgZone, private cdr: ChangeDetectorRef) {}

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
    this.loadGroups();
    this.messagesSub = this.iotService.messages$.subscribe(msg => {
      if (!msg) return;
      const devId = msg.deviceId || (msg.topic && msg.topic.split('/')[2]) || 'unknown';
      
      const currentDevice = this.deviceMap.get(devId);
      const isOfflineMsg = msg.payload === 'OFFLINE';
      
      this.deviceMap.set(devId, { 
        ...(currentDevice || { id: devId, interval: 60 }), 
        lastSeen: isOfflineMsg ? null as any : new Date(), 
        online: !isOfflineMsg 
      });
      this.deviceMap = new Map(this.deviceMap);

      const isOutgoing = (msg.topic || '').includes('commands');
      const currentMessages = this.messagesMap.get(devId) || [];
      
      // Deduplication
      const lastMsg = currentMessages[currentMessages.length - 1];
      if (lastMsg && lastMsg.text === msg.payload && (new Date().getTime() - lastMsg.timestamp.getTime() < 100)) return;

      const newMessage = { text: msg.payload || '', isOutgoing, timestamp: new Date() };
      this.messagesMap.set(devId, [...currentMessages, newMessage]);
      this.messagesMap = new Map(this.messagesMap);

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

  getSelectedGroupName(): string {
    const group = this.groups.find(g => g.id === this.selectedGroupId);
    return group ? group.name : '';
  }

  getSelectedGroupDeviceCount(): number {
    const group = this.groups.find(g => g.id === this.selectedGroupId);
    return group ? group.deviceIds.length : 0;
  }

  updateInterval(deviceId: string, seconds: number) {
    const device = this.deviceMap.get(deviceId);
    if (device) {
      device.interval = Number(seconds);
      this.deviceMap = new Map(this.deviceMap);
      // Send command to backend to change simulation logic
      this.iotService.sendCommand(deviceId, `SET_INTERVAL_${seconds}`).subscribe();
    }
  }

  addDevice() {
    const id = (this.newDeviceId || '').trim();
    if (!id) return;
    this.iotService.registerDevice(id).subscribe();
    
    const existingDevice = this.deviceMap.get(id);
    const interval = existingDevice ? existingDevice.interval : 60;
    
    this.deviceMap.set(id, { id, lastSeen: new Date(), online: true, interval });
    this.deviceMap = new Map(this.deviceMap);
    if (!this.messagesMap.has(id)) this.messagesMap.set(id, []);
    this.selectedDeviceId = id;
    this.newDeviceId = '';
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

  send() {
    const payload = (this.commandInput || '').trim();
    if ((!this.selectedDeviceId && !this.selectedGroupId) || !payload || this.sending) return;
    
    const targetId = this.selectedDeviceId || this.selectedGroupId!;
    const newMessage: ChatMessage = { text: payload, isOutgoing: true, timestamp: new Date() };
    const currentMessages = this.messagesMap.get(targetId) || [];
    this.messagesMap.set(targetId, [...currentMessages, newMessage]);
    
    this.sending = true;
    this.commandInput = '';

    if (this.selectedGroupId) {
      const group = this.groups.find(g => g.id === this.selectedGroupId);
      if (group) {
        // Send to all devices in group
        const requests = group.deviceIds.map(devId => 
          this.iotService.sendCommand(devId, payload).pipe(
            timeout(5000),
            catchError(() => of(null))
          )
        );
        
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
    } else {
      const devId = this.selectedDeviceId!;
      this.iotService.sendCommand(devId, payload).pipe(
        timeout(5000),
        catchError(() => of(null)),
        finalize(() => {
          this.ngZone.run(() => {
            this.sending = false;
            this.cdr.detectChanges();
          });
        })
      ).subscribe();
    }
  }

  updateActiveCount() {
    let n = 0;
    this.deviceMap.forEach(d => { if (this.isDeviceOnline(d.lastSeen, d.interval)) n++; });
    this.activeCount = n;
  }

  ngOnDestroy() { 
    if (this.timer) clearInterval(this.timer); 
    if (this.messagesSub) this.messagesSub.unsubscribe();
  }
}