import PWCore, {
  Address,
  AddressType,
  BuilderOption,
  Cell,
  Message,
  normalizers,
  OutPoint,
  Reader,
  SerializeWitnessArgs,
  transformers,
  WitnessArgs
} from '@lay2/pw-core';
import { getCellDeps, getRpc } from 'src/components/config';
import { getData } from 'src/components/LocalData';
import { TransferNFTProvider } from './transfer_nft-provider';
import { TransferNFTBuilder } from './transfer_nft_builder';
import { UnipassIndexerCollector } from './unipass-indexer-collector';
import { UnipassSigner } from './unipass-signer';

const collector = new UnipassIndexerCollector(
  process.env.CKB_INDEXER_URL as string
);

export interface UnipassDemoNFTInterface {
  classTypeArgs: string;
  nftTypeArgs: string;
  tokenId: string;
  outPoint: {
    txHash: string;
    index: string;
  };
}

export interface SendTxState {
  txObj: any;
  messages: Message[];
  signedOtx?: any;
  order?: any;
}

export interface SignTxMessage {
  data: string;
  messages: string;
}
export function getOutPoint(nfts: UnipassDemoNFTInterface[]): OutPoint[] {
  const outpoints: OutPoint[] = [];
  for (const item of nfts) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const outPoint = new OutPoint(item.outPoint.txHash, item.outPoint.index);
    outpoints.push(outPoint);
  }
  return outpoints;
}

export async function getNFTTransferSignMessage(
  address: string,
  nfts: UnipassDemoNFTInterface[]
): Promise<SignTxMessage | boolean> {
  const masterPubkey = getData().pubkey;
  if (!masterPubkey) return false;
  const outpoints = getOutPoint(nfts);
  console.log(address, outpoints);

  const provider = new TransferNFTProvider(
    '0x' + masterPubkey.replace('0x', '')
  );
  const fromAddress = provider.address;
  const toAddress = new Address(address, AddressType.ckb);

  console.log('[getNFTTransferSignMessage-fromAddress]', fromAddress);
  console.log('[getNFTTransferSignMessage-toAddress]', toAddress);

  const rpc = getRpc();
  const cells = await Promise.all(
    outpoints.map(x => Cell.loadFromBlockchain(rpc, x))
  );
  console.log('[cells]', cells);
  const lockLen = (1 + (8 + 256 * 2) * 2) * 2;
  const builderOption: BuilderOption = {
    witnessArgs: {
      lock: '0x' + '0'.repeat(lockLen),
      input_type: '',
      output_type: ''
    },
    collector
  };
  const cellDeps = getCellDeps();
  const builder = new TransferNFTBuilder(
    toAddress,
    cells,
    builderOption,
    cellDeps
    // [rsaDep, unipassDep, nftDep],
  );
  const tx = await builder.build();
  console.log('[getNFTTransferSignMessage-otx]', JSON.stringify(tx));
  // sign a otx
  const otxSigner = new UnipassSigner([provider]);
  const messages = otxSigner.toMessages(tx);

  console.log('[getMakerSignMessage-messages]', messages);
  const txObj = transformers.TransformTransaction(tx);
  const data = JSON.stringify({ txObj });
  console.log('[getMakerSignMessage-txObj]', data);
  console.log('to unipass', data, messages[0].message);
  return { data, messages: messages[0].message };
}

export async function getNFTransferSignCallback(
  sig: string,
  extraObj: string,
  url: string
): Promise<string> {
  console.log('getMakerSignCallback sig', sig);
  console.log('getMakerSignCallback extraObj', extraObj);
  if (!extraObj) return '0x';
  const masterPubkey = getData().pubkey;
  console.log('getMakerSignCallback masterPubkey', masterPubkey);
  if (!masterPubkey) return '0x';
  const provider = new TransferNFTProvider(masterPubkey);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { txObj } = JSON.parse(extraObj) as SendTxState;
  console.log('getMakerSignCallback txObj', txObj);
  const witnessArgs: WitnessArgs = {
    lock: '0x01' + sig.replace('0x', ''),
    input_type: '',
    output_type: ''
  };

  const witness = new Reader(
    SerializeWitnessArgs(normalizers.NormalizeWitnessArgs(witnessArgs))
  ).serializeJson();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  txObj.witnesses[0] = witness;

  const transformedTx = transformers.TransformTransaction(txObj);
  console.log('transformedTx', JSON.stringify(transformedTx));

  const pwcore = await new PWCore(url).init(provider, collector);
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const txhash = await pwcore.rpc.send_transaction(transformedTx);
    return txhash as string;
  } catch (e) {
    console.log(e);
    return '0x';
  }
}
