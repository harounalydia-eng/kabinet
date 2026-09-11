#!/usr/bin/env node
// Builds the universal "Save to KABINET" iOS Shortcut as an unsigned .shortcut plist, then signs it
// for anyone with macOS's `shortcuts sign` so iPhones accept it. Output: public/shortcuts/.
//
// What the Shortcut does (share sheet, URLs):
//   1. Reads KABINET/connection.txt from its iCloud Drive folder.
//   2. If missing: asks for the 6-character code shown in KABINET, exchanges it at /import/pair,
//      stores the returned token in that file.
//   3. POSTs the shared URL to /import with the token, shows the server's message as a notification.
// No key of any kind is embedded — only the public endpoint. The token is per customer, minted on pairing.
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envFile = resolve(root, '.env.local')
const env = existsSync(envFile) ? Object.fromEntries(readFileSync(envFile, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.split('=').map((s) => s.trim()))) : {}
const base = (process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
if (!base) {
  console.error('VITE_SUPABASE_URL is not set (.env.local).')
  process.exit(1)
}
const ENDPOINT = `${base}/functions/v1/import`
const FILE_PATH = 'KABINET/connection.txt'

// ── plist serializer ──
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function ser(v, ind = '') {
  if (typeof v === 'string') return `${ind}<string>${esc(v)}</string>`
  if (typeof v === 'boolean') return `${ind}<${v}/>`
  if (typeof v === 'number') return `${ind}<integer>${v}</integer>`
  if (Array.isArray(v)) return v.length ? `${ind}<array>\n${v.map((x) => ser(x, ind + '\t')).join('\n')}\n${ind}</array>` : `${ind}<array/>`
  const keys = Object.keys(v)
  if (!keys.length) return `${ind}<dict/>`
  return `${ind}<dict>\n${keys.map((k) => `${ind}\t<key>${esc(k)}</key>\n${ser(v[k], ind + '\t')}`).join('\n')}\n${ind}</dict>`
}

// ── Shortcuts value helpers ──
const OBJ = '￼'
/** Text with inline tokens: parts are strings or attachment objects. */
function text(parts) {
  let s = ''
  const ranges = {}
  for (const p of parts) {
    if (typeof p === 'string') s += p
    else {
      ranges[`{${s.length}, 1}`] = p
      s += OBJ
    }
  }
  return { Value: { string: s, attachmentsByRange: ranges }, WFSerializationType: 'WFTextTokenString' }
}
const out = (uuid, name) => ({ Type: 'ActionOutput', OutputUUID: uuid, OutputName: name })
const variable = (name) => ({ Type: 'Variable', VariableName: name })
const input = () => ({ Type: 'ExtensionInput' })
const attach = (a) => ({ Value: a, WFSerializationType: 'WFTextTokenAttachment' })
const dict = (entries) => ({ Value: { WFDictionaryFieldValueItems: entries.map(([k, v]) => ({ WFItemType: 0, WFKey: text([k]), WFValue: v })) }, WFSerializationType: 'WFDictionaryFieldValue' })
const action = (id, params) => ({ WFWorkflowActionIdentifier: `is.workflow.actions.${id}`, WFWorkflowActionParameters: params })

const U = { file: randomUUID(), fileText: randomUUID(), ask: randomUUID(), pair: randomUUID(), token: randomUUID(), pairMsg: randomUUID(), save: randomUUID(), msg: randomUUID() }
const G1 = randomUUID()
const G2 = randomUUID()

const HAS_ANY_VALUE = 100
const IF = 0
const OTHERWISE = 1
const END_IF = 2

const actions = [
  action('documentpicker.open', { WFGetFilePath: FILE_PATH, WFFileErrorIfNotFound: false, WFShowFilePicker: false, UUID: U.file }),
  action('conditional', { GroupingIdentifier: G1, WFControlFlowMode: IF, WFCondition: HAS_ANY_VALUE, WFInput: { Type: 'Variable', Variable: attach(out(U.file, 'File')) } }),
  action('gettext', { WFTextActionText: text([out(U.file, 'File')]), UUID: U.fileText }),
  action('setvariable', { WFVariableName: 'Token', WFInput: attach(out(U.fileText, 'Text')) }),
  action('conditional', { GroupingIdentifier: G1, WFControlFlowMode: OTHERWISE }),
  action('ask', { WFAskActionPrompt: 'Enter the 6-character code shown in KABINET', WFInputType: 'Text', WFAllowsMultilineText: false, UUID: U.ask }),
  action('downloadurl', { WFURL: `${ENDPOINT}/pair`, WFHTTPMethod: 'POST', WFHTTPBodyType: 'JSON', WFJSONValues: dict([['code', text([out(U.ask, 'Provided Input')])]]), ShowHeaders: false, UUID: U.pair }),
  action('getvalueforkey', { WFDictionaryKey: 'token', WFGetDictionaryValueType: 'Value', WFInput: attach(out(U.pair, 'Contents of URL')), UUID: U.token }),
  action('conditional', { GroupingIdentifier: G2, WFControlFlowMode: IF, WFCondition: HAS_ANY_VALUE, WFInput: { Type: 'Variable', Variable: attach(out(U.token, 'Dictionary Value')) } }),
  action('documentpicker.save', { WFAskWhereToSave: false, WFFileDestinationPath: FILE_PATH, WFSaveFileOverwrite: true, WFInput: attach(out(U.token, 'Dictionary Value')) }),
  action('setvariable', { WFVariableName: 'Token', WFInput: attach(out(U.token, 'Dictionary Value')) }),
  action('conditional', { GroupingIdentifier: G2, WFControlFlowMode: OTHERWISE }),
  action('getvalueforkey', { WFDictionaryKey: 'message', WFGetDictionaryValueType: 'Value', WFInput: attach(out(U.pair, 'Contents of URL')), UUID: U.pairMsg }),
  action('notification', { WFNotificationActionBody: text([out(U.pairMsg, 'Dictionary Value')]), WFNotificationActionSound: false }),
  action('exit', {}),
  action('conditional', { GroupingIdentifier: G2, WFControlFlowMode: END_IF }),
  action('conditional', { GroupingIdentifier: G1, WFControlFlowMode: END_IF }),
  action('downloadurl', {
    WFURL: ENDPOINT,
    WFHTTPMethod: 'POST',
    WFHTTPBodyType: 'JSON',
    WFHTTPHeaders: dict([['Authorization', text(['Bearer ', variable('Token')])]]),
    WFJSONValues: dict([
      ['url', text([input()])],
      ['source', text(['ios-shortcut'])],
    ]),
    ShowHeaders: true,
    UUID: U.save,
  }),
  action('getvalueforkey', { WFDictionaryKey: 'message', WFGetDictionaryValueType: 'Value', WFInput: attach(out(U.save, 'Contents of URL')), UUID: U.msg }),
  action('notification', { WFNotificationActionBody: text([out(U.msg, 'Dictionary Value')]), WFNotificationActionSound: false }),
]

const workflow = {
  WFWorkflowClientVersion: '2607.1.3',
  WFWorkflowMinimumClientVersion: 900,
  WFWorkflowMinimumClientVersionString: '900',
  WFWorkflowIcon: { WFWorkflowIconStartColor: 4282601983, WFWorkflowIconGlyphNumber: 59511 },
  WFWorkflowImportQuestions: [],
  WFWorkflowTypes: ['ActionExtension'],
  WFWorkflowInputContentItemClasses: ['WFURLContentItem'],
  WFWorkflowOutputContentItemClasses: [],
  WFWorkflowHasOutputFallback: false,
  WFWorkflowHasShortcutInputVariables: true,
  WFWorkflowNoInputBehavior: { Name: 'WFWorkflowNoInputBehaviorAskForInput', Parameters: { ItemClass: 'WFURLContentItem' } },
  WFWorkflowActions: actions,
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n${ser(workflow)}\n</plist>\n`
const outDir = resolve(root, 'public/shortcuts')
mkdirSync(outDir, { recursive: true })
const unsigned = resolve(tmpdir(), 'Save to KABINET.unsigned.shortcut')
const signed = resolve(outDir, 'Save to KABINET.shortcut')
writeFileSync(unsigned, xml)
execFileSync('plutil', ['-lint', unsigned], { stdio: 'inherit' })
if (process.platform === 'darwin') {
  // `shortcuts sign` prints a few ObjC runtime "Unrecognized attribute string flag" lines on macOS 15 — noise, not failures.
  execFileSync('shortcuts', ['sign', '--mode', 'anyone', '--input', unsigned, '--output', signed], { stdio: ['ignore', 'inherit', 'ignore'] })
  chmodSync(signed, 0o644)
  console.log(`Signed → ${signed}`)
} else {
  console.log('Not macOS: wrote the unsigned plist only. Sign it on a Mac: shortcuts sign --mode anyone -i <in> -o <out>')
}
rmSync(unsigned, { force: true })
console.log(`Endpoint baked in: ${ENDPOINT}`)
