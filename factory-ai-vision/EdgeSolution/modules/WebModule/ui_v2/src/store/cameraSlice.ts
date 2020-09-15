import { createSlice, createEntityAdapter, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import Axios from 'axios';
import * as R from 'ramda';
import { State } from 'RootStateType';
import { schema, normalize } from 'normalizr';
import { BoxLabel, PolygonLabel, LineLabel } from './type';
import { toggleShowAOI, toggleShowCountingLines, toggleShowDangerZones } from './actions';
import {
  insertDemoFields,
  isCRDAction,
  getInitialDemoState,
  getSliceApiByDemo,
  getConditionBySlice,
  getNonDemoSelector,
} from './shared/DemoSliceUtils';
import { GetProjectSuccessAction, InferenceMode } from './project/projectTypes';
import { Purpose } from './shared/BaseShape';

type CameraFromServer = {
  id: number;
  name: string;
  rtsp: string;
  area: string;
  lines: string;
  danger_zones: string;
  is_demo: boolean;
  location: number;
};

type CameraFromServerWithSerializeArea = Omit<CameraFromServer, 'area' | 'line' | 'danger_zones'> & {
  area: {
    useAOI: boolean;
    AOIs: [
      {
        id: string;
        type: string;
        label: BoxLabel | PolygonLabel;
      },
    ];
  };
  lines: {
    useCountingLine: boolean;
    countingLines: [
      {
        id: string;
        type: string;
        label: LineLabel;
      },
    ];
  };
  danger_zones: {
    useDangerZone: boolean;
    dangerZones: [
      {
        id: string;
        type: string;
        label: BoxLabel;
      },
    ];
  };
};

export type Camera = {
  id: number;
  name: string;
  rtsp: string;
  area: string;
  useAOI: boolean;
  location: number;
  useCountingLine: boolean;
  useDangerZone: boolean;
  isDemo: boolean;
};

const mapPurpose = (purpose: Purpose, annos) => annos.map((a) => ({ ...a, purpose }));

const normalizeCameraShape = (response: CameraFromServerWithSerializeArea) => {
  return {
    id: response.id,
    name: response.name,
    rtsp: response.rtsp,
    useAOI: response.area.useAOI,
    useCountingLine: response.lines.useCountingLine,
    useDangerZone: response.danger_zones.useDangerZone,
    AOIs: [
      ...mapPurpose(Purpose.AOI, response.area.AOIs),
      ...mapPurpose(Purpose.Counting, response.lines.countingLines),
      ...mapPurpose(Purpose.DangerZone, response.danger_zones.dangerZones),
    ],
    location: response.location,
    isDemo: response.is_demo,
  };
};

const normalizeCamerasAndAOIsByNormalizr = (data: CameraFromServerWithSerializeArea[]) => {
  const AOIs = new schema.Entity('AOIs', undefined, {
    processStrategy: (value, parent) => {
      return {
        id: value.id,
        type: value.type,
        vertices: value.label,
        camera: parent.id,
        purpose: value.purpose,
      };
    },
  });

  const cameras = new schema.Entity(
    'cameras',
    { AOIs: [AOIs] },
    {
      processStrategy: normalizeCameraShape,
    },
  );

  return normalize(data, [cameras]);
};

const getAreaData = (cameraArea: string) => {
  try {
    return JSON.parse(cameraArea);
  } catch (e) {
    return {
      useAOI: false,
      AOIs: [],
    };
  }
};

const getLineData = (countingLines: string) => {
  try {
    return JSON.parse(countingLines);
  } catch (e) {
    return { useCountingLine: false, countingLines: [] };
  }
};

const getDangerZoneData = (dangerZone: string) => {
  try {
    return JSON.parse(dangerZone);
  } catch (e) {
    return { useDangerZone: false, dangerZones: [] };
  }
};

const serializeJSONStr = R.map<CameraFromServer, CameraFromServerWithSerializeArea>((e) => ({
  ...e,
  area: getAreaData(e.area),
  lines: getLineData(e.lines),
  danger_zones: getDangerZoneData(e.danger_zones),
}));

const normalizeCameras = R.compose(normalizeCamerasAndAOIsByNormalizr, serializeJSONStr);

const entityAdapter = createEntityAdapter<Camera>();

export const getCameras = createAsyncThunk<any, boolean, { state: State }>(
  'cameras/get',
  async (isDemo) => {
    const response = await getSliceApiByDemo('cameras', isDemo);
    return normalizeCameras(response.data);
  },
  {
    condition: (isDemo, { getState }) => getConditionBySlice('camera', getState(), isDemo),
  },
);

export const postCamera = createAsyncThunk(
  'cameras/post',
  async (newCamera: Pick<Camera, 'name' | 'rtsp' | 'location'>) => {
    const response = await Axios.post(`/api/cameras/`, newCamera);
    return response.data;
  },
);

export const putCamera = createAsyncThunk(
  'cameras/put',
  async (newCamera: Pick<Camera, 'name' | 'rtsp' | 'id' | 'location'>) => {
    const response = await Axios.put(`/api/cameras/${newCamera.id}/`, newCamera);
    return response.data;
  },
);

export const deleteCamera = createAsyncThunk('cameras/delete', async (id: number) => {
  await Axios.delete(`/api/cameras/${id}/`);
  return id;
});

const isGetProjectSuccess = (action): action is GetProjectSuccessAction => {
  return action.type === isGetProjectSuccess;
};

const slice = createSlice({
  name: 'cameras',
  initialState: getInitialDemoState(entityAdapter.getInitialState()),
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getCameras.fulfilled, (state, action) =>
        entityAdapter.setAll(state, action.payload.entities.cameras || {}),
      )
      .addCase(postCamera.fulfilled, entityAdapter.addOne)
      .addCase(putCamera.fulfilled, entityAdapter.upsertOne)
      .addCase(deleteCamera.fulfilled, entityAdapter.removeOne)
      .addCase(toggleShowAOI.pending, (state, action) => {
        const { checked, cameraId } = action.meta.arg;
        state.entities[cameraId].useAOI = checked;
      })
      .addCase(toggleShowAOI.rejected, (state, action) => {
        const { checked, cameraId } = action.meta.arg;
        state.entities[cameraId].useAOI = !checked;
      })
      .addCase(toggleShowCountingLines.pending, (state, action) => {
        const { checked, cameraId } = action.meta.arg;
        state.entities[cameraId].useCountingLine = checked;
      })
      .addCase(toggleShowCountingLines.rejected, (state, action) => {
        const { checked, cameraId } = action.meta.arg;
        state.entities[cameraId].useCountingLine = !checked;
      })
      .addCase(toggleShowDangerZones.pending, (state, action) => {
        const { checked, cameraId } = action.meta.arg;
        state.entities[cameraId].useDangerZone = checked;
      })
      .addCase(toggleShowDangerZones.rejected, (state, action) => {
        const { checked, cameraId } = action.meta.arg;
        state.entities[cameraId].useDangerZone = !checked;
      })
      .addMatcher(isCRDAction, insertDemoFields)
      .addMatcher(isGetProjectSuccess, (state, action) => {
        state.ids.forEach((e) => {
          if (action.payload.project.inferenceMode !== InferenceMode.PartCounting)
            state.entities[e].useCountingLine = false;
        });
      });
  },
});

const { reducer } = slice;
export default reducer;

export const {
  selectAll: selectAllCameras,
  selectById: selectCameraById,
  selectEntities: selectCameraEntities,
} = entityAdapter.getSelectors((state: State) => state.camera);

export const selectNonDemoCameras = getNonDemoSelector('camera', selectCameraEntities);

export const cameraOptionsSelector = createSelector(selectAllCameras, (cameras) =>
  cameras
    .filter((e) => !e.isDemo)
    .map((e) => ({
      key: e.id,
      text: e.name,
    })),
);

/**
 * Return the non demo camera in the shape of IDropdownOptions.
 * If the given training project is in the predefined scenarios, also return the camera of the scenario.
 * @param trainingProjectId
 */
export const cameraOptionsSelectorInConfig = (trainingProjectId: number) =>
  createSelector([selectAllCameras, (state: State) => state.scenario], (cameras, scenarios) => {
    const relatedScenario = scenarios.find((e) => e.trainingProject === trainingProjectId);
    return cameras
      .filter((c) => !c.isDemo || relatedScenario?.cameras.includes(c.id))
      .map((e) => ({
        key: e.id,
        text: e.name,
      }));
  });

export const selectCamerasByIds = (ids) =>
  createSelector(selectCameraEntities, (entities) => ids.map((id) => entities[id]));
