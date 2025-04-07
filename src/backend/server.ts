import { createServerAdapter } from '@whatwg-node/server';
import { createServer } from 'node:http';
import { AutoRouter } from 'itty-router';
import pg from 'pg';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { Client } = pg;
const pathPrefix = process.env.API_PATH_PREFIX || '/rest/v1/';
const defaultSchema = process.env.API_DEFAULT_SCHEMA || 'public';
const schemas = (process.env.API_SCHEMAS || 'public').split(',');
const dbExtraSearchPath = (process.env.API_DB_EXTRA_SEARCH_PATH || 'public').split(',');
const allowLoginRoles = process.env.API_ALLOW_LOGIN_ROLES === 'true';
const customRelations = null;
const customPermissions = null;
const maxRows = parseInt(process.env.API_MAX_ROWS || '10', 10);

const client = new Client({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME
});

client.connect().catch(console.error);

const router = AutoRouter();

function fmtContentRangeHeader(lower: number, upper: number, total?: number): string {
  const range_string = (total !== undefined && total != 0 && lower <= upper) ? `${lower}-${upper}` : '*'
  return total !== undefined ? `${range_string}/${total}` : `${range_string}/*`
}
function getByteLength(str: string) {
  if (typeof Buffer !== 'undefined') {
      return Buffer.byteLength(str, 'utf8');
  }
  else if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str).length;
  }
  else {
      throw new Error('No TextEncoder implementation found');
  }
}

// Handle all API requests
// supports postgrest like api
// curl -v "http://localhost:3001/rest/v1/Products?select=ProductID,ProductName,UnitPrice,Category:Categories(CategoryID,CategoryName)&ProductID=eq.1"
router.all(pathPrefix + '*', async (request) => {
  try {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;
    const query = url.search.slice(1); // Remove the leading '?'
    const headers = Object.fromEntries(request.headers.entries());
    const config = {
      schema: defaultSchema,
      env: {
        'request.method': method,
        'request.headers': JSON.stringify(headers),
        'request.get': JSON.stringify(Object.fromEntries(url.searchParams)),
        'search_path': dbExtraSearchPath.join(','),
        // role: 'anonymous',
        //'request.jwt.claims': JSON.stringify({}),
      },
      path_prefix: pathPrefix,
      max_rows: maxRows,
      schemas: schemas.join(','),
      allow_login_roles: allowLoginRoles,
      custom_relations: customRelations,
      custom_permissions: customPermissions
    }
    
    // Get the request body if it exists
    let body: Buffer | null = null;
    if (request.body) {
      const arrayBuffer = await request.arrayBuffer();
      body = Buffer.from(arrayBuffer);
    }

    const result = await client.query(`
      select body, status, headers, page_total,total_result_set
      from rest.handle( row( $1, $2, $3, $4, $5 )::rest.http_request, $6 )
    `,
      [method, path, query, body, headers, config]
    );
    // log query params
    // console.log('Query params:', { method, path, query, body, headers, config });
    //console.log('Database query result:', result);
    //console.log('Result rows:', result.rows);
    //console.log('First row:', result.rows[0]);

    const {
      body: responseBody,
      status: responseStatus,
      headers: responseHeaders,
      page_total: responsePageTotal,
      total_result_set: responseTotalResultSet
    } = result.rows[0];

    const responseHeadersObj = new Headers();
    const status = Number(responseStatus) || 200;
    const pageTotal = Number(responsePageTotal) || 0;
    const totalResultSet = Number(responseTotalResultSet);
    const offset = Number(url.searchParams.get('offset') || '0') || 0;
    responseHeadersObj.set('content-length', String(getByteLength(responseBody || '')));
    responseHeadersObj.set('content-type', 'application/json');
    responseHeadersObj.set('range-unit', 'items');
    responseHeadersObj.set('content-range', fmtContentRangeHeader(
        offset,
        offset + pageTotal - 1,
        isNaN(totalResultSet) ? undefined : totalResultSet,
    ));
    if (responseHeaders) {
      Object.entries(responseHeaders).forEach(([key, value]) => {
        responseHeadersObj.set(key, value as string);
      });
    }
    // Return the response
    return new Response(responseBody, {
      status,
      headers: responseHeadersObj
    });
  } catch (error) {
    console.error('Error handling request:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Create a @whatwg-node/server
const ittyServer = createServerAdapter(router.fetch);

// Create HTTP server
const httpServer = createServer((req, res) => {
  // Create a stream to capture morgan output
  const stream = {
    write: (message: string) => console.log(message.trim())
  };
  
  // Use morgan with the stream
  morgan('combined', { stream })(req, res, () => {
    ittyServer(req, res);
  });
});

// Start the server
httpServer.listen(3001, () => {
  console.log('Server running at http://localhost:3001');
}); 