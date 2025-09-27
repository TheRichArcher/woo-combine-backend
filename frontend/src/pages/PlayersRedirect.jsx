import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PlayersRedirect() {
  const { userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userRole === 'organizer') {
      navigate('/players/roster', { replace: true });
    } else {
      navigate('/players/rankings', { replace: true });
    }
  }, [userRole]);

  return null;
}


