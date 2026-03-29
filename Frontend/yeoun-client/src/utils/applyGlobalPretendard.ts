import { Text, TextInput } from 'react-native';

const GLOBAL_PATCH_KEY = '__yeounPretendardDefaultsPatched__';

type ComponentWithDefaultProps = {
  defaultProps?: Record<string, unknown>;
};

function applyDefaultFont(component: ComponentWithDefaultProps) {
  const currentDefaultProps = component.defaultProps ?? {};
  const currentStyle = currentDefaultProps.style;

  component.defaultProps = {
    ...currentDefaultProps,
    style: [currentStyle, { fontFamily: 'Pretendard-Regular' }],
  };
}

if (!(globalThis as Record<string, unknown>)[GLOBAL_PATCH_KEY]) {
  applyDefaultFont(Text as unknown as ComponentWithDefaultProps);
  applyDefaultFont(TextInput as unknown as ComponentWithDefaultProps);
  (globalThis as Record<string, unknown>)[GLOBAL_PATCH_KEY] = true;
}

export {};
