<template>
  <q-page class="flex-center justify-evenly">
    <create-select
      :show.sync="showSelect"
      @select="bindSelect"
      class="fullscreen bg-white z-top"
    />
    <q-card class="my-card">
      <q-card-section class="row justify-around">
        <q-radio v-model="mode" val="webauthn" label="Webauthn" />
        <q-radio v-model="mode" val="subtle" label="Subtle" />
        <div>
          <q-field> {{ url }}</q-field>
          <q-select
            behavior="menu"
            filled
            use-input
            use-chips
            input-class="text-bold"
            new-value-mode="add-unique"
            v-model="url"
            :options="urls"
            option-value="url"
            option-label="name"
            emit-value
            map-options
          />
        </div>
      </q-card-section>
    </q-card>
    <q-card class="my-card">
      <!-- home -->
      <q-card-section class="q-gutter-sm">
        <q-btn
          class="full-width"
          color="info"
          icon="home"
          label="Go Home"
          @click="goHome"
        />
      </q-card-section>

      <!-- info -->
      <q-card-section class="q-gutter-sm">
        <div class="row"><b>EMAIL:</b> {{ provider && provider.email }}</div>
        <div class="row" style="word-break: break-all;">
          <b>ADDRESS:</b> {{ provider && provider.address }}
        </div>
        <q-btn
          class="full-width"
          color="primary"
          type="submit"
          icon="login"
          label="Login"
          @click="login"
        />

        <q-btn
          class="full-width"
          color="info"
          icon="check"
          label="Logout"
          @click="logout"
        />
      </q-card-section>
      <q-separator spaced />
      <!-- transfer -->
      <q-card-section class="q-gutter-sm">
        <div class="row">
          <q-input
            class="full-width"
            v-model="toAddress"
            type="text"
            label="To Ethereum address on Godwoken:"
          />
        </div>
        <div class="row" style="word-break: break-all;">
          <b>Nervos Layer 1 TX:</b>
          <a
            :href="`https://explorer.nervos.org/aggron/transaction/${txHash}`"
            >{{ txHash }}</a
          >
        </div>
      </q-card-section>
      <q-separator spaced />

      <!-- transfer NFT -->
      <q-card-section>
        <div>
          <div class="full-width">
            <q-btn class="full-width" @click="openNFTList">Choose NFT</q-btn>
          </div>
          <div>
            <div class="nft-list">
              <template v-for="(e, i) in nfts">
                <div v-if="e.checked.length" :key="i" class="nft">
                  <div class="nft-info">
                    <el-image
                      class="nft-image"
                      :src="e.renderer"
                      alt="bg_image_url"
                      fit="cover"
                      lazy
                    />
                    <div class="info">
                      <div class="name">{{ e.name }}</div>
                      <div class="user">
                        <div class="user-name">{{ e.issuerName }}</div>
                      </div>
                    </div>
                  </div>
                  <div class="nft-box">
                    <el-checkbox-group v-model="e.checked">
                      <template v-for="nft in e.children">
                        <el-checkbox
                          v-if="e.checked.includes(nft.tokenId)"
                          :key="nft.tokenId"
                          class="nft-one"
                          :label="nft.tokenId"
                          >#{{ nft.tokenId }}</el-checkbox
                        >
                      </template>
                    </el-checkbox-group>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </q-card-section>
      <q-separator spaced />

      <!-- transfer ticket -->
      <q-card-section
        class="q-gutter-sm full-width row wrap justify-around items-center content-start"
      >
        <q-btn
          label="Bridge mNFT to Godwoken"
          color="primary"
          no-caps
          class="col-3"
          @click="postTransferNFT"
        />
      </q-card-section>
      <q-separator spaced />

      <q-card-section class="q-gutter-sm"> </q-card-section>
      <q-separator spaced />
    </q-card>
    <q-footer class="text-center" @click="goto('https://lay2.tech')">
      <span class="text-caption">Unipass v2</span>
    </q-footer>
  </q-page>
</template>

<script lang="ts">
import PWCore, {
  RPC,
  Reader,
  Address,
  AddressType,
  Amount,
  IndexerCollector,
  normalizers,
  SerializeWitnessArgs,
  WitnessArgs,
  transformers,
  Message
} from '@lay2/pw-core';
import { defineComponent, ref } from '@vue/composition-api';
import UnipassProvider from 'src/components/UnipassProvider';
import UnipassBuilder from 'src/components/UnipassBuilder';
import UnipassSigner from 'src/components/UnipassSigner';
import { createHash } from 'crypto';
import { Logout, getData, saveAddress } from 'src/components/LocalData';
import { nets, saveEnvData, getCkbEnv } from 'src/components/config';
import { getDataFromUrl, getPublick } from 'src/components/utils';
import { LocalStorage } from 'quasar';
import createSelect from 'src/components/create-select.vue';
import {
  getNFTTransferSignMessage,
  SignTxMessage,
  getNFTransferSignCallback,
  UnipassDemoNFTInterface
} from 'src/compositions/transfer';
import { NFT } from 'src/compositions/nft';
import { CONFIG } from 'src/compositions/config';

export enum ActionType {
  Init,
  Login,
  SignMsg,
  SendTx,
  SendTransferTx,
}

export interface PageState {
  action: ActionType;
  data: PageData;
  extraObj: string;
}
export interface PageData {
  mode: string;
  message: string;
  signature: string;
  pubkey: string;
  toAddress: string;
  toAmount: number;
  txHash: string;
  success: string;
  url: string;
}
export interface SendTxState {
  txObj: any;
  messages: Message[];
}

function generateUnipassNewUrl(
  host: string,
  action: string,
  params: { [key: string]: string }
) {
  const urlObj = new URL(`${host}/${action.toLowerCase()}`);
  for (const key of Object.keys(params)) {
    urlObj.searchParams.set(key, params[key]);
  }
  console.log('urlObj.href', urlObj.href);
  return urlObj.href;
}

export default defineComponent({
  components: { createSelect },
  name: 'PageIndex',
  beforeRouteEnter(to, from, next) {
    console.log('from', from.path);
    console.log('to', to.path);
    next();
  },
  async created() {
    try {
      const pageState = this.restoreState();
      let action = ActionType.Init;
      if (!!pageState) action = pageState.action;

      getDataFromUrl();
      const data = getData();
      if (data.pubkey) {
        console.log('this.address', this.address);
        const url = getCkbEnv();

        PWCore.chainId = url.CHAIN_ID;
        await new PWCore(url.NODE_URL).init(
          new UnipassProvider(data.email, data.pubkey),
          new IndexerCollector(url.INDEXER_URL),
          url.CHAIN_ID
        );
        this.provider = PWCore.provider as UnipassProvider;
        this.address = PWCore.provider.address.addressString;
        saveAddress(PWCore.provider.address.addressString);
        console.log(
          'PWCore',
          PWCore.provider.address,
          PWCore.chainId,
          this.address,
          '------'
        );
      }

      switch (action) {
        case ActionType.Init:
          break;
        case ActionType.Login:
          this.pubkey = data.pubkey;

          break;
        case ActionType.SignMsg:
          if (data.sig) {
            this.pubkey = data.pubkey;
            this.signature = `0x01${data.sig.replace('0x', '')}`;
          }
          break;
        case ActionType.SendTx:
          if (data.sig)
            await this.sendTxCallback(data.sig, pageState?.extraObj);
          break;
        case ActionType.SendTransferTx:
          if (data.sig) {
            const url = getCkbEnv();
            const extra = pageState?.extraObj as string;
            const txhash = await getNFTransferSignCallback(
              data.sig,
              extra,
              url.NODE_URL
            );
            this.txHash = txhash;
          }

          break;
      }
    } catch (e) {
      return;
    }
  },
  setup() {
    const urls = nets;
    let provider = ref<UnipassProvider>();

    const mode = ref('subtle');
    const message = ref('');
    const signature = ref('');
    const pubkey = ref('');
    const toAddress = ref('');
    const toAmount = ref(0);
    const txHash = ref('');
    const success = ref('');

    saveEnvData(urls[0].url);
    const nfts: any[] = [];
    const nftChecked: any[] = [];
    return {
      mode,
      url: urls[0].url,
      provider,
      toAddress,
      toAmount,
      txHash,
      message,
      signature,
      pubkey,
      urls,
      success,
      nfts,
      nftChecked,
      address: ref(''),
      showSelect: ref(false)
    };
  },

  methods: {
    bindSelect(nfts: any[], checked: any[]) {
      this.nfts = nfts;
      this.nftChecked = checked;
    },
    goHome() {
      window.location.href = this.url;
    },
    saveState(action: ActionType, extraObj = '') {
      const pageState: PageState = {
        action,
        extraObj,
        data: {
          mode: this.mode,
          message: this.message,
          signature: this.signature,
          pubkey: this.pubkey,
          toAddress: this.toAddress,
          toAmount: this.toAmount,
          txHash: this.txHash,
          success: this.success,
          url: this.url
        } as PageData
      };
      LocalStorage.set('page_state', pageState);
    },
    restoreState(): PageState | undefined {
      const pageState = LocalStorage.getItem('page_state') as PageState;
      if (!pageState) return undefined;

      const pageData = pageState.data;

      this.mode = pageData.mode;
      this.message = pageData.message;
      this.signature = pageData.signature;
      this.pubkey = pageData.pubkey;
      this.toAddress = pageData.toAddress;
      this.toAmount = pageData.toAmount;
      this.txHash = pageData.txHash;
      this.url = pageData.url;

      saveEnvData(this.url);
      LocalStorage.remove('page_state');

      return pageState;
    },
    login() {
      const host = this.url;
      const success_url = window.location.origin;
      window.location.href = generateUnipassNewUrl(host, 'login', {
        success_url
      });
      this.saveState(ActionType.Login);
    },
    recovery() {
      this.success = '重签功能失效';
    },
    async send() {
      try {
        if (!this.provider) throw new Error('Need Login');
        console.log(
          'this.provider.address',
          this.provider.address.toCKBAddress()
        );
        const builder = new UnipassBuilder(
          // this.provider.address,
          new Address(this.toAddress, AddressType.ckb),
          new Amount(`${this.toAmount}`)
        );
        console.log(builder);
        const signer = new UnipassSigner(this.provider);

        const tx = await builder.build();
        console.log('tx', tx);
        const messages = signer.toMessages(tx);
        console.log('messages', messages);

        const host = this.url;
        const success_url = window.location.origin;
        const fail_url = window.location.origin;
        const pubkey = this.pubkey;
        console.log('pubkey', pubkey);
        if (!pubkey) return;
        // const _url = `${host}?success_url=${success_url}&fail_url=${fail_url}&pubkey=${pubkey}&message=${messages[0].message}/#sign`;
        let _url = '';
        _url = generateUnipassNewUrl(host, 'sign', {
          success_url,
          fail_url,
          pubkey,
          message: messages[0].message
        });
        const txObj = transformers.TransformTransaction(tx);
        this.saveState(ActionType.SendTx, JSON.stringify({ txObj, messages }));
        console.log(_url);
        window.location.href = _url;
      } catch (err) {
        console.error(err);
      }
    },
    openNFTList() {
      const localData = getData();
      this.address = localData.address;
      this.showSelect = true;
    },
    async postTransferNFT() {
      console.log('postTransferNFT', {
        nftChecked: this.nftChecked
      });
      if (!this.toAddress) return;
      if (this.nftChecked.length === 0) {
        this.showSelect = true;
        return;
      }

      const nft: NFT = this.nftChecked[0].nft;

      const classTypeArgs = nft.nftClassCell?.output.type?.args;
      const nftTypeArgs = nft.typeScriptArguments;

      if (!classTypeArgs) {
        throw new Error('classTypeArgs undefined');
      }

      const unipassExpectedNft: UnipassDemoNFTInterface = {
        classTypeArgs,
        nftTypeArgs,
        tokenId: nft.getTypeScriptArguments().tokenId.toString(),
        outPoint: {
         txHash: nft.outpoint.tx_hash,
         index: nft.outpoint.index
        }
      };

      const data = await getNFTTransferSignMessage(
        CONFIG.LAYER_ONE_BRIDGE_CKB_ADDRESS,
        [unipassExpectedNft],
        this.toAddress
      );
      if (!data) return;
      const localData = getData();
      const pubkey = localData.pubkey;
      const host = this.url;
      const success_url = window.location.origin;
      let _url = '';

      _url = generateUnipassNewUrl(host, 'sign', {
        success_url,
        pubkey,
        message: (data as SignTxMessage).messages
      });
      this.saveState(ActionType.SendTransferTx, (data as SignTxMessage).data);
      console.log(_url);
      window.location.href = _url;
    },
    async sendTxCallback(sig: string, extraObj: string | undefined) {
      if (!extraObj) return;
      try {
        console.log('sendTxCallback sig', sig);
        console.log('sendTxCallback extraObj', extraObj);
        const witnessArgs: WitnessArgs = {
          lock: '0x01' + sig.replace('0x', ''),
          input_type: '',
          output_type: ''
        };

        const witness = new Reader(
          SerializeWitnessArgs(normalizers.NormalizeWitnessArgs(witnessArgs))
        ).serializeJson();

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { txObj, messages } = JSON.parse(extraObj) as SendTxState;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        txObj.witnesses[0] = witness;

        console.log('txObj', txObj);

        const url = getCkbEnv();
        console.log('url', url);
        const rpc = new RPC(url.NODE_URL);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.txHash = await rpc.send_transaction(txObj, 'passthrough');
        console.log('this.txHash', this.txHash);
      } catch (err) {
        console.error('send tx error', err);
      }
    },
    sign() {
      console.log('[sign] message: ', this.mode);
      const messageHash = createHash('SHA256')
        .update(this.message || '0x')
        .digest('hex')
        .toString();
      const host = this.url;
      const success_url = window.location.origin;

      const pubkey = getPublick();
      if (!this.provider || !pubkey) return;
      // const _url = `${host}?success_url=${success_url}&fail_url=${fail_url}&pubkey=${pubkey}&message=${messageHash}/#sign`;
      let _url = '';

      _url = generateUnipassNewUrl(host, 'sign', {
        success_url,
        pubkey,
        message: messageHash
      });
      this.saveState(ActionType.SignMsg);
      console.log(_url);
      window.location.href = _url;
    },
    goto(url: string) {
      window.location.href = url;
    },

    logout() {
      Logout();
      void window.location.reload();
    }
  },
  watch: {
    url(newVal: string) {
      console.log(newVal);
      saveEnvData(newVal);
    }
  }
});
</script>

<style lang="stylus">
.nft-list {
  width: 100%;
  border: 0;
  .nft {
    .nft-info {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 16px 0;
      cursor: pointer;
      margin-right: 6px;

      .nft-image {
        background: #eee;
        height: 50px;
        width: 50px;
        flex-shrink: 0;
        box-shadow: 0px 1px 3px 1px rgba(0, 0, 0, 0.24);
        border-radius: 4px;
        overflow: hidden;
      }

      .info {
        margin-top: 4px;
        margin-left: 10px;

        .name {
          color: rgba(16, 16, 16, 100);
          font-size: 16px;
          line-height: 16px;
          font-weight: bold;
        }

        .user {
          margin-top: 5px;
          display: flex;
          align-items: center;

          .user-name {
            font-size: 14px;
            color: #aaa;
          }
        }
      }
    }

    .nft-box {
      display: flex;
      flex-wrap: wrap;
      border-bottom: 1px solid #f4f4f4;

      .nft-one {
        margin-bottom: 14px;
        border-radius: 5px;
        background: #e6e6e6;
        margin-right: 24px;
        width: 50px;
        height: 26px;
        line-height: 26px;
        text-align: center;

        .el-checkbox__input {
          display: none;
        }

        .el-checkbox__label {
          padding-left: 0;
        }
      }

      .nft-one.is-checked {
        background: #f35543;

        .el-checkbox__input.is-checked + .el-checkbox__label {
          color: #fff;
        }
      }
    }
  }
}
</style>
