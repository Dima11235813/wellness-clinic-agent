import { GraphService, createGraphService } from './graph-service.js';

let graphServiceInstance: GraphService | null = null;

export function setGraphService(service: GraphService) {
  graphServiceInstance = service;
}

export function getGraphService(): GraphService | null {
  return graphServiceInstance;
}
