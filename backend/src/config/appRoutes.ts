import express from 'express';
import instrumentRoutes from '../routes/instrumentRoutes';
import alertRoutes from '../routes/alertRoutes';
import groupRoutes from '../routes/groupRoutes';
import mergeRoutes from '../routes/mergeRoutes';
import authRoutes from '../routes/authRoutes';
import flowRoutes from '../routes/flowRoutes';
import historyRoutes from '../routes/historyRoutes';
import settingsRoutes from '../routes/settingsRoutes';
import userRoutes from '../routes/userRoutes';
import auditRoutes from '../routes/auditRoutes';
import statisticsRoutes from '../routes/statisticsRoutes';
import templateRoutes from '../routes/templateRoutes';
import backupRoutes from '../routes/backupRoutes';
import maintenanceRoutes from '../routes/maintenanceRoutes';
import scheduleRoutes from '../routes/scheduleRoutes';
import messageRoutes from '../routes/messageRoutes';
import lengthShadowLinkageRoutes from '../routes/lengthShadowLinkageRoutes';
import shadowKnifeTaskRoutes from '../routes/shadowKnifeTaskRoutes';
import oneClickTransferRoutes from '../routes/oneClickTransferRoutes';

type RouteRegistration = {
  mountPath: string;
  router: express.Router;
};

export const APP_ROUTE_REGISTRATIONS: RouteRegistration[] = [
  { mountPath: '/api/auth', router: authRoutes },
  { mountPath: '/api/instruments', router: instrumentRoutes },
  { mountPath: '/api/flow', router: flowRoutes },
  { mountPath: '/api/alerts', router: alertRoutes },
  { mountPath: '/api', router: groupRoutes },
  { mountPath: '/api', router: mergeRoutes },
  { mountPath: '/api/history', router: historyRoutes },
  { mountPath: '/api/settings', router: settingsRoutes },
  { mountPath: '/api/excel-templates', router: templateRoutes },
  { mountPath: '/api/users', router: userRoutes },
  { mountPath: '/api/audits', router: auditRoutes },
  { mountPath: '/api/statistics', router: statisticsRoutes },
  { mountPath: '/api/backup', router: backupRoutes },
  { mountPath: '/api/maintenance', router: maintenanceRoutes },
  { mountPath: '/api/messages', router: messageRoutes },
  { mountPath: '/api/schedule', router: scheduleRoutes },
  { mountPath: '/api/length-shadow-linkage', router: lengthShadowLinkageRoutes },
  { mountPath: '/api/shadow-knife-linkage', router: shadowKnifeTaskRoutes },
  { mountPath: '/api/one-click-transfer', router: oneClickTransferRoutes },
];
