import { CHAINS_DATA } from './types'

export default (
  state = {
    [`${CHAINS_DATA}`]: null,
  },
  action,
) => {
  switch (action.type) {
    case CHAINS_DATA:
      return {
        ...state,
        [`${CHAINS_DATA}`]: action.value,
      }
    default:
      return state
  }
}