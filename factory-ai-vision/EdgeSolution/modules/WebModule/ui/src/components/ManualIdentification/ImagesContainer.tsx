import React, { FC, Dispatch, memo } from 'react';
import { Grid } from '@fluentui/react-northstar';
import ImageIdentificationItem from './ImageItem';
import { JudgedImageList, RelabelImage } from './types';

interface ImagesContainerProps {
  images: RelabelImage[];
  judgedImageList: JudgedImageList;
  setJudgedImageList: Dispatch<JudgedImageList>;
  selectedPartId: number;
}
const ImagesContainer: FC<ImagesContainerProps> = ({
  images,
  judgedImageList,
  setJudgedImageList,
  selectedPartId,
}) => (
  <Grid
    columns="2"
    styles={{
      width: '100%',
      height: '80%',
      overflow: 'scroll',
      borderWidth: '0.0625em',
      borderStyle: 'solid',
      rowGap: '10px',
    }}
  >
    {images
      .filter((img) => img.display)
      .map((img, i, arr) => {
        if (img.display) {
          let isPartCorrect: number = null;
          const idx = judgedImageList.findIndex((e) => e.imageId === img.id);

          if (idx >= 0) {
            if (judgedImageList[idx].partId === selectedPartId) {
              isPartCorrect = 1;
            } else isPartCorrect = 0;
          }

          return (
            <ImageIdentificationItem
              key={img.id}
              confidenceLevel={img.confidenceLevel}
              imageIndex={i}
              relabelImages={arr}
              isPartCorrect={isPartCorrect}
              setJudgedImageList={setJudgedImageList}
              partId={selectedPartId}
            />
          );
        }
        return void 0;
      })}
  </Grid>
);

export default memo(ImagesContainer);
