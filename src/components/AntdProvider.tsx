"use client";

import { ConfigProvider, theme } from "antd";

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#5e8fe6",
          colorPrimaryHover: "#6a9aef",
          colorPrimaryActive: "#4b7bd8",
          colorInfo: "#5e8fe6",
          colorBgBase: "#0b1830",
          colorBgContainer: "#101a32",
          colorBgElevated: "#0f172b",
          colorText: "#e9f1ff",
          colorTextSecondary: "#b0c7e6",
          colorBorder: "rgba(126, 174, 255, 0.36)",
          colorBorderSecondary: "rgba(103, 163, 255, 0.26)",
          borderRadius: 12,
          borderRadiusLG: 16,
          controlHeight: 40,
          fontFamily: 'var(--sans)',
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}