// @flow

import type { GenericObject } from '../../common/type-common'
import type { AgencyPoolConfig } from '../../store/type-config-store'
import type {
  VcxProvision,
  VcxProvisionResult,
  CxsInitConfig,
  VcxInitConfig,
  CxsPushTokenConfig,
  VcxPushTokenConfig,
  VcxCreateConnection,
  VcxConnectionConnectResult,
  VcxCredentialOffer,
  WalletPoolName,
  VcxPoolInitConfig,
  CxsPoolConfigWithGenesisPath,
} from './type-cxs'
import type { UserOneTimeInfo } from '../../store/user/type-user-store'
import type { InvitationPayload } from '../../invitation/type-invitation'
import type { CredentialOffer } from '../../claim-offer/type-claim-offer'
import type { MyPairwiseInfo } from '../../store/type-connection-store'
import type { ClaimOfferPushPayload } from '../../push-notification/type-push-notification'
import { getWalletKey } from '../../services/storage'
import { appName, vcxPushType } from '../../external-imports'
import DeviceInfo from 'react-native-device-info'
import { flattenAsync } from '../../common/flatten-async'
import { Platform } from 'react-native'
import { getDeviceAttestation } from '../../start-up/device-check-saga'
import { flatJsonParse } from '../../common/flat-json-parse'

export const paymentHandle = 0
const commonConfigParams = {
  protocol_type: '3.0',
}

export async function convertAgencyConfigToVcxProvision(
  config: AgencyPoolConfig,
  walletPoolName: WalletPoolName
): Promise<VcxProvision> {
  const wallet_key = await getWalletKey()

  return {
    agency_url: config.agencyUrl,
    agency_did: config.agencyDID,
    agency_verkey: config.agencyVerificationKey,
    wallet_name: walletPoolName.walletName,
    wallet_key,
    agent_seed: null,
    enterprise_seed: null,
    payment_method: config.paymentMethod,
    ...commonConfigParams,
  }
}

export async function addAttestation(token: string) {
  const [parseError, parsedToken] = flatJsonParse(token)
  if (parseError || !parsedToken || !parsedToken.nonce) {
    return token
  }

  const [attestationError, attestationSignature] = await flattenAsync(
    getDeviceAttestation
  )(parsedToken.nonce)
  if (attestationError || !attestationSignature) {
    return token
  }

  return JSON.stringify({
    ...parsedToken,
    attestationAlgorithm: Platform.OS === 'ios' ? 'DeviceCheck' : 'SafetyNet',
    attestationData: attestationSignature,
  })
}

export function convertVcxProvisionResultToUserOneTimeInfo(
  provision: VcxProvisionResult
): UserOneTimeInfo {
  return {
    oneTimeAgencyDid: provision.institution_did,
    oneTimeAgencyVerificationKey: provision.institution_verkey,
    myOneTimeDid: provision.sdk_to_remote_did,
    myOneTimeVerificationKey: provision.sdk_to_remote_verkey,
    myOneTimeAgentDid: provision.remote_to_sdk_did,
    myOneTimeAgentVerificationKey: provision.remote_to_sdk_verkey,
  }
}

export async function convertCxsInitToVcxInit(
  init: CxsInitConfig,
  walletPoolName: WalletPoolName
): Promise<VcxInitConfig> {
  const wallet_key = await getWalletKey()
  const [, deviceName] = await flattenAsync(DeviceInfo.getDeviceName)()

  return {
    agency_endpoint: init.agencyUrl,
    agency_did: init.agencyDID,
    agency_verkey: init.agencyVerificationKey,
    wallet_name: walletPoolName.walletName,
    wallet_key,
    remote_to_sdk_did: init.myOneTimeAgentDid,
    remote_to_sdk_verkey: init.myOneTimeAgentVerificationKey,
    sdk_to_remote_did: init.myOneTimeDid,
    sdk_to_remote_verkey: init.myOneTimeVerificationKey,
    // TODO: These should be removed after we sdk team fix these as optional
    institution_name: deviceName || appName,
    institution_logo_url: 'https://try.connect.me/img/CMicon@3x.png',
    institution_did: init.oneTimeAgencyDid,
    institution_verkey: init.oneTimeAgencyVerificationKey,
    payment_method: init.paymentMethod,
    ...commonConfigParams,
  }
}

export async function convertCxsPoolInitToVcxPoolInit(
  init: CxsPoolConfigWithGenesisPath,
  walletPoolName: WalletPoolName
): Promise<VcxPoolInitConfig> {
  return {
    genesis_path: init.genesis_path,
    pool_name: walletPoolName.poolName,
  }
}

export function convertCxsPushConfigToVcxPushTokenConfig(
  pushConfig: CxsPushTokenConfig
): VcxPushTokenConfig {
  return {
    type: vcxPushType,
    id: pushConfig.uniqueId,
    value: pushConfig.pushToken,
  }
}

export function convertInvitationToVcxConnectionCreate(
  invitation: InvitationPayload
): VcxCreateConnection {
  return {
    source_id: invitation.requestId,
    invite_details: {
      connReqId: invitation.requestId,
      // TODO: Add status code to be available in invitation payload
      // for now, it would always be MS-102
      statusCode: 'MS-102',
      senderDetail: invitation.senderDetail,
      senderAgencyDetail: invitation.senderAgencyDetail,
      targetName: invitation.senderName,
      // hard coding this for now, because this field does not matter anywhere for processing
      // and it will always be message sent for the purpose of connection create
      statusMsg: 'message sent',
      ...(invitation.version ? { version: invitation.version } : {}),
    },
  }
}

export function convertVcxConnectionToCxsConnection(
  vcxConnection: VcxConnectionConnectResult
): MyPairwiseInfo {
  return {
    myPairwiseDid: vcxConnection.pw_did,
    myPairwiseVerKey: vcxConnection.pw_verkey,
    myPairwiseAgentDid: vcxConnection.agent_did,
    myPairwiseAgentVerKey: vcxConnection.agent_vk,
    myPairwisePeerVerKey: vcxConnection.their_pw_verkey,
    senderDID: vcxConnection.their_pw_did,
  }
}

export function convertVcxCredentialOfferToCxsClaimOffer(
  vcxCredentialOffer: VcxCredentialOffer
): ClaimOfferPushPayload {
  return {
    msg_type: vcxCredentialOffer.msg_type,
    version: vcxCredentialOffer.version,
    to_did: vcxCredentialOffer.to_did,
    from_did: vcxCredentialOffer.from_did,
    claim: vcxCredentialOffer.credential_attrs,
    claim_name: vcxCredentialOffer.claim_name || 'Unknown',
    schema_seq_no: vcxCredentialOffer.schema_seq_no,
    issuer_did: vcxCredentialOffer.from_did,
    // should override it when generating claim offer object
    remoteName: '',
    price: vcxCredentialOffer.price,
  }
}

export function convertAriesCredentialOfferToCxsClaimOffer(
  credentialOffer: CredentialOffer
): ClaimOfferPushPayload {
  let claim: GenericObject = {}

  for (const a of credentialOffer.credential_preview.attributes) {
    claim[a.name] = a.value
  }

  return {
    msg_type: 'credential-offer',
    version: '0.1',
    to_did: '',
    from_did: '',
    claim: claim,
    claim_name: credentialOffer.comment || 'Unknown',
    schema_seq_no: 0,
    issuer_did: '',
    // should override it when generating claim offer object
    remoteName: '',
  }
}
