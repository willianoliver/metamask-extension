import { cloneDeep } from 'lodash';

const version = 70;

/**
 * Renames NotificationController to AnnouncementController
 */
export default {
  version,
  async migrate(originalVersionedData) {
    const versionedData = cloneDeep(originalVersionedData);
    versionedData.meta.version = version;
    const state = versionedData.data;
    const newState = transformState(state);
    versionedData.data = newState;
    return versionedData;
  },
};

function transformState(state) {
  if (state.NotificationController) {
    state.AnnouncementController = state.NotificationController;
    delete state.NotificationController;
  }
  return state;
}
