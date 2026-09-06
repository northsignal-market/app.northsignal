import { Client } from '@notionhq/client';

const notionKey = process.env.NOTION_API_KEY;
export const notion = notionKey ? new Client({ auth: notionKey }) : null;
