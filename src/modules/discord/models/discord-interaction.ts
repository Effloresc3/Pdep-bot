import { InteractionType } from 'discord-api-types/v10';

export interface DiscordInteraction {
  app_permissions: string;
  application_id: string;
  authorizing_integration_owners: {
    [key: string]: string;
  };
  channel: {
    flags: number;
    guild_id: string;
    icon_emoji?: {
      id: string | null;
      name: string;
    };
    id: string;
    last_message_id: string;
    name: string;
    nsfw: boolean;
    parent_id: string;
    permissions: string;
    position: number;
    rate_limit_per_user: number;
    theme_color: string | null;
    topic: string | null;
    type: number;
  };
  channel_id: string;
  context: number;
  data: {
    id: string;
    name: string;
    options?: Array<{
      name: string;
      value: string;
      type?: number;
    }>;
    resolved?: {
      members?: Record<string, any>;
      users?: Record<string, any>;
    };
    type: number;
  };
  entitlement_sku_ids: string[];
  entitlements: any[];
  guild: {
    features: string[];
    id: string;
    locale: string;
  };
  guild_id: string;
  guild_locale: string;
  id: string;
  locale: string;
  member: {
    avatar: string | null;
    banner: string | null;
    communication_disabled_until: string | null;
    deaf: boolean;
    flags: number;
    joined_at: string;
    mute: boolean;
    nick: string | null;
    pending: boolean;
    permissions: string;
    premium_since: string | null;
    roles: string[];
    unusual_dm_activity_until: string | null;
    user: {
      avatar: string;
      avatar_decoration_data: unknown;
      clan: unknown;
      collectibles: unknown;
      discriminator: string;
      global_name: string;
      id: string;
      primary_guild: unknown;
      public_flags: number;
      username: string;
    };
  };
  token: string;
  type: InteractionType;
  version: number;
}
