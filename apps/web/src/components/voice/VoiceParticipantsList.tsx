"use client";

import React, { useEffect } from "react";
import { useVoiceStore } from "../../features/voice/voiceStore";
import ParticipantTile from "./ParticipantTile";
import { getChannelVoiceStates } from "../../services/api/voice";

interface VoiceParticipantsListProps {
    channelId: string;
    channelName: string;
}

/**
 * Compact inline list of voice participants shown under a voice channel in the sidebar.
 * Shows compact avatar tiles with speaking indicators.
 */
export default function VoiceParticipantsList({ channelId, channelName }: VoiceParticipantsListProps) {
    const participants = useVoiceStore((s) => s.participants);
    const setParticipant = useVoiceStore((s) => s.setParticipant);

    useEffect(() => {
        let active = true;
        getChannelVoiceStates(channelId)
            .then((states) => {
                if (!active) return;
                states.forEach((vs) => {
                    setParticipant(vs.user_id, vs);
                });
            })
            .catch((err) => {
                console.error("Failed to fetch initial voice states for channel", channelId, err);
            });

        return () => {
            active = false;
        };
    }, [channelId, setParticipant]);

    const channelParticipants = Array.from(participants.values()).filter(
        (p) => p.channel_id === channelId
    );

    if (channelParticipants.length === 0) return null;

    return (
        <div className="mt-0.5 ml-2 space-y-0.5">
            {channelParticipants.map((p) => (
                <ParticipantTile
                    key={p.user_id}
                    participant={p}
                    channelId={channelId}
                    compact
                />
            ))}
        </div>
    );
}
