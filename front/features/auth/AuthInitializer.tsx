"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setUser, clearUser } from "./authSlice";
import { selectCurrentUser, selectIsInitialized } from "./authSelectors";
import { useGetMeQuery } from "@/services/api/authApi";
import { socket } from "@/services/socket";
interface AuthInitializerProps {
  children: React.ReactNode;
}

export default function AuthInitializer({ children }: AuthInitializerProps) {
  const dispatch = useAppDispatch();
  const isInitialized = useAppSelector(selectIsInitialized);
  const currentUser = useAppSelector(selectCurrentUser);
  const { data, isSuccess, isError, isLoading } = useGetMeQuery(undefined, {
    skip: isInitialized,
  });

  const hasHandled = useRef(false);

  useEffect(() => {
    if (isInitialized || hasHandled.current) return;
    if (isLoading) return;

    if (isSuccess && data?.success && data.data?.user) {
      hasHandled.current = true;
      dispatch(setUser(data.data.user));
    } else if (isError) {
      hasHandled.current = true;
      dispatch(clearUser());
    }
  }, [isInitialized, isLoading, isSuccess, isError, data, dispatch]);
    useEffect(() => {
      if (!isInitialized || !currentUser) {
        return;
      }

      socket.connect();

      return () => {
        socket.disconnect();
      };
    }, [isInitialized, currentUser]);
  if (!isInitialized && isLoading) {
    return null;
  }

  return <>{children}</>;
}
