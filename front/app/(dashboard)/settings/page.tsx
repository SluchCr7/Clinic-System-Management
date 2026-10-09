"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/redux/hooks";
import { selectCurrentUser } from "@/features/auth/authSelectors";
import { useChangePasswordMutation } from "@/services/api/authApi";
import {
  useUpdateUserMutation,
  useUpdateProfilePhotoMutation,
} from "@/services/api/userApi";
import { useTheme, type Theme } from "@/components/providers/ThemeProvider";
import {
  PageHeader,
  Card,
  CardHeader,
  CardContent,
  Button,
  Input,
  Avatar,
  Badge,
  Tabs,
  Select,
  toast,
} from "@/components/ui";
import { extractApiError } from "@/services/api/baseQuery";
import {
  LuUser,
  LuShield,
  LuBuilding2,
  LuCircleCheck,
  LuCamera,
  LuKeyRound,
  LuPalette,
  LuSun,
  LuMoon,
  LuMonitor,
  LuCheck,
  LuSparkles,
} from "react-icons/lu";

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const currentUser = useAppSelector(selectCurrentUser);
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam && ["profile", "security", "clinic", "appearance"].includes(tabParam)) {
        return tabParam;
      }
    }
    return "profile";
  });

  // Profile Form State
  const [firstName, setFirstName] = useState(currentUser?.firstName || "");
  const [lastName, setLastName] = useState(currentUser?.lastName || "");
  const [phone, setPhone] = useState(currentUser?.phone || "");

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Mutations
  const [updateUser, { isLoading: isUpdatingProfile }] = useUpdateUserMutation();
  const [updateProfilePhoto, { isLoading: isUploadingPhoto }] = useUpdateProfilePhotoMutation();
  const [changePassword, { isLoading: isChangingPassword }] = useChangePasswordMutation();

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      await updateUser({
        id: currentUser._id,
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
        },
      }).unwrap();

      toast.success(t("settings.messages.profileUpdated", "Profile updated successfully"));
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("settings.messages.profileUpdateFailed", "Failed to update profile"));
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("photo", file);

    try {
      await updateProfilePhoto(formData).unwrap();
      toast.success(t("settings.messages.photoUpdated", "Photo updated successfully"));
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("settings.messages.photoUpdateFailed", "Failed to update photo"));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword) {
      toast.error(t("settings.messages.providePasswords", "Please provide passwords"));
      return;
    }

    if (newPassword.length < 6) {
      toast.error(t("settings.messages.passwordLength", "Password must be at least 6 characters"));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("settings.messages.passwordMismatch", "Passwords do not match"));
      return;
    }

    try {
      await changePassword({
        currentPassword,
        newPassword,
      }).unwrap();

      toast.success(t("settings.messages.passwordChanged", "Password changed successfully"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("settings.messages.passwordChangeFailed", "Failed to change password"));
    }
  };

  const tabs = [
    { id: "profile", label: t("settings.profileTab", "Profile"), icon: <LuUser className="w-4 h-4" /> },
    { id: "security", label: t("settings.securityTab", "Security"), icon: <LuShield className="w-4 h-4" /> },
    { id: "appearance", label: t("settings.appearanceTab", "Appearance"), icon: <LuPalette className="w-4 h-4" /> },
    { id: "clinic", label: t("settings.clinicTab", "Clinic"), icon: <LuBuilding2 className="w-4 h-4" /> },
  ];

  const themeCards: Array<{
    id: Theme;
    title: string;
    description: string;
    icon: React.ReactNode;
    previewBg: string;
    previewSurface: string;
    previewBorder: string;
    previewText: string;
  }> = [
    {
      id: "light",
      title: t("theme.light", "Light"),
      description: t("theme.lightDesc", "Clean, high-readability daylight clinical workspace"),
      icon: <LuSun className="w-5 h-5 text-amber-500" />,
      previewBg: "#F8FAFC",
      previewSurface: "#FFFFFF",
      previewBorder: "#E2E8F0",
      previewText: "#0F172A",
    },
    {
      id: "dark",
      title: t("theme.dark", "Dark"),
      description: t("theme.darkDesc", "Layered dark slate palette for low-light clinical environments"),
      icon: <LuMoon className="w-5 h-5 text-teal-primary" />,
      previewBg: "#0B1120",
      previewSurface: "#111827",
      previewBorder: "#273449",
      previewText: "#F8FAFC",
    },
    {
      id: "system",
      title: t("theme.system", "System"),
      description: t("theme.systemDesc", "Automatically synchronizes with your device operating system"),
      icon: <LuMonitor className="w-5 h-5 text-slate-muted" />,
      previewBg: "#172033",
      previewSurface: "#111827",
      previewBorder: "#334155",
      previewText: "#CBD5E1",
    },
  ];

  const languageOptions = [
    { value: "ar", label: "العربية (RTL)" },
    { value: "en", label: "English (LTR)" },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <PageHeader
        title={t("settings.title", "Settings & Preferences")}
        subtitle={t("settings.subtitle", "Manage your account, visual appearance, and clinic configuration")}
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: Appearance & Theme */}
      {activeTab === "appearance" && (
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              title={t("theme.appearance", "Visual Appearance")}
              subtitle={t("theme.appearanceSubtitle", "Customize light, dark mode and platform display preferences")}
            />
            <CardContent>
              <div className="flex flex-col gap-6">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-muted mb-3 block">
                    {t("theme.label", "Visual Theme")}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {themeCards.map((item) => {
                      const isSelected = theme === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setTheme(item.id)}
                          className={`flex flex-col text-left p-4 rounded-xl border transition-all text-xs focus:outline-none relative ${
                            isSelected
                              ? "border-teal-primary bg-mint/15 shadow-subtle ring-2 ring-teal-primary/20"
                              : "border-border-subtle bg-surface hover:border-border-medium hover:bg-paper/40"
                          }`}
                        >
                          {/* Mini visual mockup preview */}
                          <div
                            className="w-full h-20 rounded-lg p-2 flex flex-col justify-between mb-3 border shadow-xs"
                            style={{
                              backgroundColor: item.previewBg,
                              borderColor: item.previewBorder,
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div
                                className="h-2 w-12 rounded-sm"
                                style={{ backgroundColor: item.previewBorder }}
                              />
                              <div className="h-2 w-4 rounded-sm bg-teal-primary" />
                            </div>
                            <div
                              className="h-9 rounded p-1.5 border flex items-center justify-between"
                              style={{
                                backgroundColor: item.previewSurface,
                                borderColor: item.previewBorder,
                              }}
                            >
                              <div
                                className="h-2 w-16 rounded-xs"
                                style={{ backgroundColor: item.previewText, opacity: 0.8 }}
                              />
                              <div className="h-3 w-3 rounded-full bg-teal-primary" />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              {item.icon}
                              <span className="font-bold text-ink text-sm">
                                {item.title}
                              </span>
                            </div>
                            {isSelected && (
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-teal-dark">
                                <LuCheck className="w-3.5 h-3.5 text-teal-primary" />
                                {t("theme.active", "Active")}
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-muted leading-relaxed">
                            {item.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color Palette Information */}
                <div className="pt-5 border-t border-border-subtle">
                  <div className="flex items-center gap-2 mb-2">
                    <LuSparkles className="w-4 h-4 text-teal-primary" />
                    <span className="text-xs font-semibold text-ink">
                      {t("theme.colorScheme", "Clinical Precision Design System")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-muted mb-3 leading-relaxed">
                    {t(
                      "theme.colorSchemeDesc",
                      "Medical-grade teal accent with layered slate backgrounds and WCAG compliant contrast ratios."
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="teal" dot size="sm">
                      Brand Teal (#14B8A6 / #2DD4BF)
                    </Badge>
                    <Badge variant="success" dot size="sm">
                      Success
                    </Badge>
                    <Badge variant="warning" dot size="sm">
                      Warning
                    </Badge>
                    <Badge variant="error" dot size="sm">
                      Error
                    </Badge>
                    <Badge variant="info" dot size="sm">
                      Info
                    </Badge>
                  </div>
                </div>

                {/* Language Switcher */}
                <div className="pt-5 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-ink">
                      {t("theme.language", "Platform Language & Direction")}
                    </h4>
                    <p className="text-xs text-slate-muted mt-0.5">
                      {t(
                        "theme.languageDesc",
                        "Switch interface language and layout direction (Arabic RTL / English LTR)"
                      )}
                    </p>
                  </div>
                  <div className="w-48 shrink-0">
                    <Select
                      value={i18n.language}
                      onChange={(e) => i18n.changeLanguage(e.target.value)}
                      options={languageOptions}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Profile */}
      {activeTab === "profile" && (
        <div className="flex flex-col gap-5">
          {/* Avatar and Identity Overview */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div className="relative group">
                  <Avatar
                    name={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "User"}
                    src={currentUser?.profilePhoto?.url}
                    size="lg"
                  />
                  <label
                    htmlFor="avatar-upload"
                    className="absolute inset-0 bg-overlay/80 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <LuCamera className="w-5 h-5" />
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={isUploadingPhoto}
                    />
                  </label>
                </div>

                <div className="flex flex-col text-center sm:text-left gap-1">
                  <h3 className="font-bold text-base text-ink">
                    {currentUser?.firstName} {currentUser?.lastName}
                  </h3>
                  <p className="text-xs text-slate-muted">{currentUser?.email}</p>
                  <div className="mt-1 flex items-center justify-center sm:justify-start gap-2">
                    <Badge variant="teal" size="sm" className="capitalize font-semibold">
                      {currentUser?.role}
                    </Badge>
                    <Badge variant="success" size="sm" dot>
                      {t("settings.activeAccount", "Active Account")}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit Information Form */}
          <Card>
            <CardHeader
              title={t("settings.profileTitle", "Personal Details")}
              subtitle={t("settings.profileSubtitle", "Update your name and clinic contact number")}
            />
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={t("settings.firstName", "First Name")}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                  <Input
                    label={t("settings.lastName", "Last Name")}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={t("settings.emailAddress", "Email Address")}
                    value={currentUser?.email || ""}
                    disabled
                    helperText={t("settings.emailReadOnly", "Email cannot be changed")}
                  />
                  <Input
                    label={t("settings.phoneNumber", "Phone Number")}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555-0199"
                  />
                </div>

                <div className="flex justify-end pt-3 border-t border-border-subtle">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isUpdatingProfile}
                    leftIcon={<LuCircleCheck className="w-3.5 h-3.5" />}
                  >
                    {t("settings.saveChanges", "Save Changes")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Security */}
      {activeTab === "security" && (
        <Card>
          <CardHeader
            title={t("settings.securityTitle", "Change Account Password")}
            subtitle={t("settings.securitySubtitle", "Ensure your account is protected with a secure and unique password")}
          />
          <CardContent>
            <form onSubmit={handleChangePassword} className="flex flex-col gap-4 max-w-lg">
              <Input
                label={t("settings.currentPassword", "Current Password")}
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />

              <Input
                label={t("settings.newPassword", "New Password")}
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />

              <Input
                label={t("settings.confirmPassword", "Confirm New Password")}
                type="password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <div className="flex justify-end pt-3 border-t border-border-subtle">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isChangingPassword}
                  leftIcon={<LuKeyRound className="w-3.5 h-3.5" />}
                >
                  {t("settings.updatePassword", "Update Password")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tab: Clinic Configuration */}
      {activeTab === "clinic" && (
        <Card>
          <CardHeader
            title={t("settings.clinicTitle", "Clinic Profile & Institutional Parameters")}
            subtitle={t("settings.clinicSubtitle", "Global clinical operational guidelines and institutional identifiers")}
          />
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-paper rounded-lg border border-border-subtle">
                <span className="text-[10px] uppercase font-semibold text-slate-muted">{t("settings.clinicFacilityName", "Clinic Name")}</span>
                <p className="font-bold text-ink mt-0.5">Aegis Precision Clinic</p>
              </div>

              <div className="p-3 bg-paper rounded-lg border border-border-subtle">
                <span className="text-[10px] uppercase font-semibold text-slate-muted">{t("settings.institutionalLicense", "License Number")}</span>
                <p className="font-mono font-semibold text-teal-dark mt-0.5">MOH-CLN-88319</p>
              </div>

              <div className="p-3 bg-paper rounded-lg border border-border-subtle">
                <span className="text-[10px] uppercase font-semibold text-slate-muted">{t("settings.standardSlotDuration", "Slot Duration")}</span>
                <p className="font-medium text-ink mt-0.5">15 Minutes per Consultation</p>
              </div>

              <div className="p-3 bg-paper rounded-lg border border-border-subtle">
                <span className="text-[10px] uppercase font-semibold text-slate-muted">{t("settings.billingCurrency", "Billing Currency")}</span>
                <p className="font-medium text-ink mt-0.5">USD ($) • Zero-Rated Clinical Tax</p>
              </div>

              <div className="p-3 bg-paper rounded-lg border border-border-subtle col-span-2">
                <span className="text-[10px] uppercase font-semibold text-slate-muted">{t("settings.operationalHours", "Operational Hours")}</span>
                <p className="font-medium text-ink mt-0.5">
                  Monday – Friday: 08:00 AM – 06:00 PM • Saturday: 09:00 AM – 02:00 PM • Sunday: Urgent Care Only
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
