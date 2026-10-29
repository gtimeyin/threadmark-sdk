import { useLayoutEffect, useRef } from 'react';
import * as video from './VideoFeedback.jsx';
import { videoStyles } from './videoStyles.js';
import { installFeatureStyles } from './featureStyles.js';

function styled(Component) {
  return function VideoFeature(props) {
    const ref = useRef(null);
    useLayoutEffect(() => { installFeatureStyles(ref.current?.getRootNode(), videoStyles); }, []);
    return <span ref={ref} style={{ display: 'contents' }}><Component {...props} /></span>;
  };
}
export const VideoSetupPanel = styled(video.VideoSetupPanel);
export const VideoRecorderBar = styled(video.VideoRecorderBar);
export const CameraBubble = styled(video.CameraBubble);
export const RecordingCursorLayer = styled(video.RecordingCursorLayer);
export const VideoPreview = styled(video.VideoPreview);
export const VoiceReplay = styled(video.VoiceReplay);
