---
layout: default
parent: Architecture
---
---
layout: default
title: gRPC API Design
parent: Architecture
nav_order: 6
---
# gRPC API Design for Agent Communication

## Overview

This document outlines the gRPC API design for future implementation to support high-performance, real-time communication between OpenCTEM agents and the backend server.

## When to Implement gRPC

Consider implementing gRPC when:
- Number of agents exceeds 50+
- Real-time command push is required (no polling)
- Large batch finding ingestion (1000+ findings per scan)
- Streaming logs/events from agents
- Low-latency communication is critical

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    OpenCTEM Server                        │
├─────────────────────────────────────────────────────────┤
│  HTTP REST API          │  gRPC API                     │
│  (Port 8080)            │  (Port 9090)                  │
│                         │                               │
│  • Dashboard/UI         │  • Command streaming          │
│  • External integrations│  • Bulk finding ingest        │
│  • Webhooks             │  • Real-time status           │
│  • Simple agents        │  • Log streaming              │
└─────────────────────────────────────────────────────────┘
                              │
                              │ gRPC (HTTP/2)
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────┴────┐           ┌────┴────┐          ┌────┴────┐
   │ Agent 1 │           │ Agent 2 │          │ Agent N │
   └─────────┘           └─────────┘          └─────────┘
```

## Proto Definitions

### Directory Structure

```
api/
├── api/
│   └── proto/
│       ├── common.proto       # Shared types
│       ├── agent.proto        # Agent service
│       ├── command.proto      # Command streaming
│       └── ingest.proto       # Finding ingestion
├── internal/
│   └── infra/
│       └── grpc/
│           ├── server.go
│           ├── agent_service.go
│           ├── command_service.go
│           ├── ingest_service.go
│           └── interceptors/
│               ├── auth.go
│               └── logging.go
```

### common.proto

```protobuf
syntax = "proto3";

package.openctem.v1;

option go_package = "github.com/openctemio/api/api/proto/v1";

import "google/protobuf/timestamp.proto";

// Severity levels
enum Severity {
  SEVERITY_UNSPECIFIED = 0;
  SEVERITY_CRITICAL = 1;
  SEVERITY_HIGH = 2;
  SEVERITY_MEDIUM = 3;
  SEVERITY_LOW = 4;
  SEVERITY_INFO = 5;
}

// Priority levels
enum Priority {
  PRIORITY_UNSPECIFIED = 0;
  PRIORITY_CRITICAL = 1;
  PRIORITY_HIGH = 2;
  PRIORITY_NORMAL = 3;
  PRIORITY_LOW = 4;
}

// Command status
enum CommandStatus {
  COMMAND_STATUS_UNSPECIFIED = 0;
  COMMAND_STATUS_PENDING = 1;
  COMMAND_STATUS_ACKNOWLEDGED = 2;
  COMMAND_STATUS_RUNNING = 3;
  COMMAND_STATUS_COMPLETED = 4;
  COMMAND_STATUS_FAILED = 5;
  COMMAND_STATUS_CANCELLED = 6;
  COMMAND_STATUS_EXPIRED = 7;
}

// Agent status
enum AgentStatus {
  AGENT_STATUS_UNSPECIFIED = 0;
  AGENT_STATUS_STARTING = 1;
  AGENT_STATUS_RUNNING = 2;
  AGENT_STATUS_SCANNING = 3;
  AGENT_STATUS_IDLE = 4;
  AGENT_STATUS_STOPPING = 5;
  AGENT_STATUS_ERROR = 6;
}
```

### agent.proto

```protobuf
syntax = "proto3";

package.openctem.v1;

option go_package = "github.com/openctemio/api/api/proto/v1";

import "google/protobuf/timestamp.proto";
import "common.proto";

// AgentService handles agent lifecycle and status
service AgentService {
  // Register a new agent
  rpc Register(RegisterRequest) returns (RegisterResponse);

  // Send heartbeat (unary)
  rpc Heartbeat(HeartbeatRequest) returns (HeartbeatResponse);

  // Bidirectional stream for real-time status updates
  rpc StatusStream(stream AgentStatusUpdate) returns (stream ServerMessage);
}

message RegisterRequest {
  string name = 1;
  string type = 2;  // scanner, collector, agent
  repeated string capabilities = 3;
  string version = 4;
  string hostname = 5;
}

message RegisterResponse {
  string agent_id = 1;
  string api_key = 2;
  google.protobuf.Timestamp registered_at = 3;
}

message HeartbeatRequest {
  string agent_id = 1;
  AgentStatus status = 2;
  string message = 3;
  int64 uptime_seconds = 4;
  int64 total_scans = 5;
  int64 errors = 6;
  map<string, string> metrics = 7;
}

message HeartbeatResponse {
  bool acknowledged = 1;
  google.protobuf.Timestamp server_time = 2;
}

message AgentStatusUpdate {
  string agent_id = 1;
  AgentStatus status = 2;
  string message = 3;
  map<string, string> metrics = 4;
  google.protobuf.Timestamp timestamp = 5;
}

message ServerMessage {
  oneof message {
    CommandNotification command = 1;
    ConfigUpdate config = 2;
    ShutdownRequest shutdown = 3;
  }
}

message CommandNotification {
  string command_id = 1;
  string type = 2;
  Priority priority = 3;
}

message ConfigUpdate {
  map<string, string> config = 1;
}

message ShutdownRequest {
  string reason = 1;
  int32 grace_period_seconds = 2;
}
```

### command.proto

```protobuf
syntax = "proto3";

package.openctem.v1;

option go_package = "github.com/openctemio/api/api/proto/v1";

import "google/protobuf/timestamp.proto";
import "google/protobuf/struct.proto";
import "common.proto";

// CommandService handles command distribution and execution
service CommandService {
  // Subscribe to command stream (server push)
  rpc Subscribe(SubscribeRequest) returns (stream Command);

  // Acknowledge command receipt
  rpc Acknowledge(AcknowledgeRequest) returns (AcknowledgeResponse);

  // Report command progress
  rpc ReportProgress(stream ProgressUpdate) returns (ProgressResponse);

  // Complete command execution
  rpc Complete(CompleteRequest) returns (CompleteResponse);

  // Report command failure
  rpc Fail(FailRequest) returns (FailResponse);
}

message SubscribeRequest {
  string agent_id = 1;
  repeated string command_types = 2;  // Filter by command types
  int32 max_concurrent = 3;  // Max concurrent commands to receive
}

message Command {
  string id = 1;
  string type = 2;
  Priority priority = 3;
  google.protobuf.Struct payload = 4;
  google.protobuf.Timestamp created_at = 5;
  google.protobuf.Timestamp expires_at = 6;
}

message AcknowledgeRequest {
  string command_id = 1;
  string agent_id = 2;
}

message AcknowledgeResponse {
  bool success = 1;
  CommandStatus status = 2;
}

message ProgressUpdate {
  string command_id = 1;
  int32 progress_percent = 2;  // 0-100
  string message = 3;
  map<string, string> metrics = 4;
  google.protobuf.Timestamp timestamp = 5;
}

message ProgressResponse {
  bool acknowledged = 1;
}

message CompleteRequest {
  string command_id = 1;
  string agent_id = 2;
  google.protobuf.Struct result = 3;
}

message CompleteResponse {
  bool success = 1;
  CommandStatus status = 2;
}

message FailRequest {
  string command_id = 1;
  string agent_id = 2;
  string error_message = 3;
  string error_code = 4;
}

message FailResponse {
  bool success = 1;
  CommandStatus status = 2;
}
```

### ingest.proto

```protobuf
syntax = "proto3";

package.openctem.v1;

option go_package = "github.com/openctemio/api/api/proto/v1";

import "google/protobuf/timestamp.proto";
import "google/protobuf/struct.proto";
import "common.proto";

// IngestService handles finding and asset ingestion
service IngestService {
  // Ingest findings (unary - for small batches)
  rpc IngestFindings(IngestFindingsRequest) returns (IngestResponse);

  // Stream findings (for large batches)
  rpc StreamFindings(stream Finding) returns (IngestResponse);

  // Ingest assets (unary)
  rpc IngestAssets(IngestAssetsRequest) returns (IngestResponse);

  // Stream assets
  rpc StreamAssets(stream Asset) returns (IngestResponse);

  // Bidirectional stream for continuous ingestion
  rpc IngestStream(stream IngestItem) returns (stream IngestAck);
}

message IngestFindingsRequest {
  string scan_id = 1;
  ScanMetadata metadata = 2;
  repeated Finding findings = 3;
}

message IngestAssetsRequest {
  string scan_id = 1;
  ScanMetadata metadata = 2;
  repeated Asset assets = 3;
}

message ScanMetadata {
  string tool_name = 1;
  string tool_version = 2;
  google.protobuf.Timestamp start_time = 3;
  google.protobuf.Timestamp end_time = 4;
  string source_id = 5;
}

message Finding {
  string id = 1;  // Client-generated ID for deduplication
  string rule_id = 2;
  Severity severity = 3;
  string title = 4;
  string description = 5;
  Location location = 6;
  string fingerprint = 7;
  string target_id = 8;  // Reference to asset
  google.protobuf.Struct metadata = 9;
}

message Location {
  string file_path = 1;
  int32 start_line = 2;
  int32 end_line = 3;
  int32 start_column = 4;
  int32 end_column = 5;
  string snippet = 6;
}

message Asset {
  string id = 1;  // Client-generated ID
  string type = 2;
  string identifier = 3;
  string name = 4;
  string description = 5;
  google.protobuf.Struct metadata = 6;
}

message IngestResponse {
  string scan_id = 1;
  int32 findings_created = 2;
  int32 findings_updated = 3;
  int32 findings_skipped = 4;
  int32 assets_created = 5;
  int32 assets_updated = 6;
  repeated string errors = 7;
}

message IngestItem {
  oneof item {
    Finding finding = 1;
    Asset asset = 2;
  }
  string batch_id = 3;
  int32 sequence = 4;
}

message IngestAck {
  string batch_id = 1;
  int32 sequence = 2;
  bool success = 3;
  string error = 4;
}
```

## Implementation Notes

### Authentication

```go
// interceptors/auth.go
func AuthInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
    md, ok := metadata.FromIncomingContext(ctx)
    if !ok {
        return nil, status.Error(codes.Unauthenticated, "missing metadata")
    }

    apiKey := md.Get("x-api-key")
    if len(apiKey) == 0 {
        return nil, status.Error(codes.Unauthenticated, "missing api key")
    }

    // Validate API key and get source
    source, err := validateAPIKey(apiKey[0])
    if err != nil {
        return nil, status.Error(codes.Unauthenticated, "invalid api key")
    }

    // Add source to context
    ctx = context.WithValue(ctx, sourceKey, source)
    return handler(ctx, req)
}
```

### Connection Management

```go
// Server-side keep-alive settings
keepalive.ServerParameters{
    MaxConnectionIdle:     15 * time.Minute,
    MaxConnectionAge:      30 * time.Minute,
    MaxConnectionAgeGrace: 5 * time.Second,
    Time:                  5 * time.Second,
    Timeout:               1 * time.Second,
}
```

### Error Handling

Use gRPC status codes:
- `codes.InvalidArgument` - Bad request data
- `codes.Unauthenticated` - Missing/invalid API key
- `codes.PermissionDenied` - Unauthorized action
- `codes.NotFound` - Resource not found
- `codes.ResourceExhausted` - Rate limit exceeded
- `codes.Internal` - Server error

## Performance Considerations

### Batch Size
- Unary ingest: Up to 1000 findings per request
- Streaming: Recommended batch of 100-500 findings per stream message

### Connection Pooling
- Agents should maintain a single gRPC connection
- Use connection multiplexing (HTTP/2)

### Compression
```go
grpc.UseCompressor(gzip.Name)
```

## Migration Path

1. **Phase 1**: Implement gRPC server alongside REST
2. **Phase 2**: Add gRPC support to SDK client
3. **Phase 3**: Migrate heavy-traffic agents to gRPC
4. **Phase 4**: Keep REST for simple integrations

## SDK Changes Required

```go
// sdk/client/grpc_client.go
type GRPCClient struct {
    conn           *grpc.ClientConn
    agentClient    pb.AgentServiceClient
    commandClient  pb.CommandServiceClient
    ingestClient   pb.IngestServiceClient
}

func NewGRPCClient(cfg *Config) (*GRPCClient, error) {
    opts := []grpc.DialOption{
        grpc.WithTransportCredentials(insecure.NewCredentials()), // or TLS
        grpc.WithPerRPCCredentials(apiKeyAuth{apiKey: cfg.APIKey}),
        grpc.WithKeepaliveParams(keepalive.ClientParameters{
            Time:                10 * time.Second,
            Timeout:             3 * time.Second,
            PermitWithoutStream: true,
        }),
    }

    conn, err := grpc.Dial(cfg.GRPCAddress, opts...)
    if err != nil {
        return nil, err
    }

    return &GRPCClient{
        conn:          conn,
        agentClient:   pb.NewAgentServiceClient(conn),
        commandClient: pb.NewCommandServiceClient(conn),
        ingestClient:  pb.NewIngestServiceClient(conn),
    }, nil
}
```

## Monitoring

### Metrics to Track
- `grpc_server_started_total` - Total RPCs started
- `grpc_server_handled_total` - Total RPCs completed
- `grpc_server_msg_received_total` - Messages received
- `grpc_server_msg_sent_total` - Messages sent
- `grpc_server_handling_seconds` - RPC latency histogram

### Health Check
```protobuf
service Health {
  rpc Check(HealthCheckRequest) returns (HealthCheckResponse);
  rpc Watch(HealthCheckRequest) returns (stream HealthCheckResponse);
}
```

## References

- [gRPC Go Documentation](https://grpc.io/docs/languages/go/)
- [Protocol Buffers](https://protobuf.dev/)
- [gRPC Best Practices](https://grpc.io/docs/guides/performance/)
