/**
 * Types for POST /api/channel/list-messages on chime-messaging-go-api.
 * Ported from the list-messages Go tool (models.go). If the API shape changes, update this file.
 */

/** JSON body sent to /api/channel/list-messages. */
export interface ListMessagesRequest {
  channelArn: string;
  /** The user the messages are listed as; must be a member of the channel. */
  messagingUserId: string;
}

export interface MessageSender {
  Arn: string;
  Name: string;
}

export interface ChannelMessage {
  Content: string;
  CreatedTimestamp: string;
  LastEditedTimestamp: string | null;
  LastUpdatedTimestamp: string;
  MessageId: string;
  Metadata: string | null;
  Redacted: boolean;
  Sender: MessageSender;
  Type: string;
}

/** Messages is null when the channel has no messages. */
export interface ListMessagesResponse {
  Messages: ChannelMessage[] | null;
  NextToken: string | null;
}
