const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const Logger = require('../utils/logger');
const processHandler = require('./handlers/processHandler');

const logger = new Logger('GrpcServer');

/**
 * GRPC Server for Microservice
 */
class GrpcServer {
  constructor() {
    this.server = null;
    this.port = process.env.GRPC_PORT || 50051;
  }

  /**
   * Start GRPC server
   */
  async start() {
    try {
      logger.info('Starting GRPC server', {
        service: process.env.SERVICE_NAME || 'skills-engine-backend',
        port: this.port
      });

      // Load proto file
      const PROTO_PATH = path.join(__dirname, '../../proto/microservice.proto');
      const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      });

      // Load package
      const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
      const microservice = protoDescriptor.microservice.v1;

      // Create server
      this.server = new grpc.Server();

      // Register Process handler
      this.server.addService(microservice.MicroserviceAPI.service, {
        Process: processHandler.handle.bind(processHandler)
      });

      // Bind and start
      await new Promise((resolve, reject) => {
        this.server.bindAsync(
          `0.0.0.0:${this.port}`,
          grpc.ServerCredentials.createInsecure(),
          (error, port) => {
            if (error) {
              logger.error('Failed to start GRPC server', error);
              reject(error);
              return;
            }
            logger.info('GRPC server started', {
              service: process.env.SERVICE_NAME || 'skills-engine-backend',
              port
            });
            this.server.start();
            resolve();
          }
        );
      });
    } catch (error) {
      logger.error('GRPC server startup failed', error);
      throw error;
    }
  }

  /**
   * Shutdown GRPC server
   */
  async shutdown() {
    if (this.server) {
      logger.info('Shutting down GRPC server', {
        service: process.env.SERVICE_NAME || 'skills-engine-backend'
      });
      await new Promise((resolve) => {
        this.server.tryShutdown(() => {
          logger.info('GRPC server shut down', {
            service: process.env.SERVICE_NAME || 'skills-engine-backend'
          });
          resolve();
        });
      });
    }
  }
}

module.exports = new GrpcServer();


