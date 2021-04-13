import { call, put, takeEvery, all } from 'redux-saga/effects'
import {
  createOutOfBandConnectionInvitation,
  credentialGetPresentationProposal,
} from '../bridge/react-native-cxs/RNCxs'
import { saveNewOneTimeConnection } from '../store/connections-store'
import { customLogger } from '../store/custom-logger'
import { getClaim } from '../claim/claim-store'
import type {
  ShowCredentialAction,
  ShowCredentialActions,
  ShowCredentialStore,
} from './type-show-credential'
import {
  SHOW_CREDENTIAL,
  CREDENTIAL_PRESENTATION_SENT,
  SHOW_CREDENTIAL_FAIL,
  SHOW_CREDENTIAL_READY,
  SHOW_CREDENTIAL_FINISHED,
  ShowCredentialStoreInitialState,
  showCredentialFail,
  showCredentialReady,
} from './type-show-credential'

export function* preparePresentationProposalSaga(
  action: ShowCredentialAction,
): Generator<*, *, *> {
  try {
    const claim = yield call(getClaim, action.claimOfferUuid)
    if (!claim) {
      yield put(showCredentialFail('Cannot prepare Presentation Proposal. Credential not found'))
      return
    }

    const presentationProposal = yield call(credentialGetPresentationProposal, claim.handle)
    if (!presentationProposal) {
      yield put(showCredentialFail('Cannot prepare Presentation Proposal'))
      return
    }

    const {
      invitation,
      pairwiseInfo,
      vcxSerializedConnection,
    } = yield call(
      createOutOfBandConnectionInvitation,
      `Show \"${claim.claim.name}\" Credential`,
      false,
      presentationProposal,
    )

    const attachedRequest = invitation ? JSON.parse(invitation)['request~attach'][0] : undefined

    const connection = {
      identifier: pairwiseInfo.myPairwiseDid,
      ...pairwiseInfo,
      vcxSerializedConnection,
      attachedRequest,
    }

    yield put(showCredentialReady(invitation, claim.claimUuid, connection.identifier))
    yield put(saveNewOneTimeConnection(connection))
  } catch (error) {
    customLogger.log(`preparePresentationProposalSaga: error: ${error}`)
    yield put(showCredentialFail(error.message))
  }
}

export function* watchShowCredential(): any {
  yield takeEvery(SHOW_CREDENTIAL, preparePresentationProposalSaga)
}

export function* watchShowCredentialStore(): any {
  yield all([
    watchShowCredential(),
  ])
}


export default function showCredentialReducer(
  state: ShowCredentialStore = ShowCredentialStoreInitialState,
  action: ShowCredentialActions,
) {
  switch (action.type) {
    case SHOW_CREDENTIAL:
      return ShowCredentialStoreInitialState
    case SHOW_CREDENTIAL_READY:
      return {
        ...state,
        data: action.presentationProposal,
        credentialUuid: action.credentialUuid,
        connectionIdentifier: action.connectionIdentifier,
      }
    case SHOW_CREDENTIAL_FAIL:
      return {
        ...state,
        error: action.error,
      }
    case CREDENTIAL_PRESENTATION_SENT:
      return {
        ...state,
        isSent: true,
      }

    case SHOW_CREDENTIAL_FINISHED:
      return ShowCredentialStoreInitialState

    default:
      return state
  }
}
