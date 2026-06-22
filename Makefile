include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-eventcenter
PKG_VERSION:=1.0.3
PKG_RELEASE:=1

LUCI_TITLE:=Event Center - 通用事件通知中心
LUCI_DESCRIPTION:=路由器事件通知中心，支持 Telegram/微信等多通道通知
LUCI_DEPENDS:=+curl
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
$(eval $(call BuildPackage,luci-app-eventcenter))
