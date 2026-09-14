import { inflateRawSync } from 'node:zlib';
import { ZipArchive } from 'archiver';
// Trusted, small test fixtures only. Production ZIP reading uses yauzl.
export function zipEntries(buffer: Buffer) {
  const files = new Map<string, Buffer>();
  const end = buffer.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  let cursor = buffer.readUInt32LE(end+16);
  for (let i=0;i<buffer.readUInt16LE(end+10);i++) {
    const method=buffer.readUInt16LE(cursor+10),size=buffer.readUInt32LE(cursor+20),length=buffer.readUInt16LE(cursor+28),extra=buffer.readUInt16LE(cursor+30),comment=buffer.readUInt16LE(cursor+32),local=buffer.readUInt32LE(cursor+42);
    const name=buffer.subarray(cursor+46,cursor+46+length).toString(),start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28),data=buffer.subarray(start,start+size);
    files.set(name,method===8?inflateRawSync(data):data);cursor+=46+length+extra+comment;
  }
  return files;
}
export async function zipFixture(files: Iterable<[string,Buffer]>) {
  const zip = new ZipArchive({ zlib:{ level:3 } }), chunks: Buffer[]=[];
  const result = new Promise<Buffer>((resolve,reject)=> { zip.on('data',chunk=>chunks.push(chunk));zip.once('error',reject);zip.once('end',()=>resolve(Buffer.concat(chunks))); });
  for(const [name,content] of files) zip.append(content,{name});
  await zip.finalize();return result;
}
