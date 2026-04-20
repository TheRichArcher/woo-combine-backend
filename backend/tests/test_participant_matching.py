from backend.utils.participant_matching import infer_sibling_group_assignments


def test_infer_sibling_groups_uses_household_signals_within_division():
    players = [
        {
            "id": "p1",
            "age_group": "U10",
            "parentEmailNormalized": "family@example.com",
            "cellPhoneNormalized": None,
            "streetNormalized": "123 main st",
            "parentLastNameNormalized": "smith",
            "siblingSeparationRequested": False,
        },
        {
            "id": "p2",
            "age_group": "U10",
            "parentEmailNormalized": "family@example.com",
            "cellPhoneNormalized": None,
            "streetNormalized": "123 main st",
            "parentLastNameNormalized": "smith",
            "siblingSeparationRequested": False,
        },
        {
            "id": "p3",
            "age_group": "U12",
            "parentEmailNormalized": "family@example.com",
            "cellPhoneNormalized": None,
            "streetNormalized": "123 main st",
            "parentLastNameNormalized": "smith",
            "siblingSeparationRequested": False,
        },
    ]

    assignments = infer_sibling_group_assignments(players, event_id="event-x")
    assert assignments["p1"]["forceSameTeamWithSibling"] is True
    assert assignments["p2"]["forceSameTeamWithSibling"] is True
    assert assignments["p1"]["siblingGroupId"] == assignments["p2"]["siblingGroupId"]

    # Different division should never be forced into the same sibling group.
    assert assignments["p3"]["forceSameTeamWithSibling"] is False
    assert assignments["p3"]["siblingGroupId"] is None


def test_infer_sibling_groups_respects_separation_opt_out():
    players = [
        {
            "id": "p1",
            "age_group": "U10",
            "parentEmailNormalized": "family@example.com",
            "cellPhoneNormalized": "5551112222",
            "streetNormalized": "123 main st",
            "parentLastNameNormalized": "smith",
            "siblingSeparationRequested": True,
        },
        {
            "id": "p2",
            "age_group": "U10",
            "parentEmailNormalized": "family@example.com",
            "cellPhoneNormalized": "5551112222",
            "streetNormalized": "123 main st",
            "parentLastNameNormalized": "smith",
            "siblingSeparationRequested": False,
        },
    ]

    assignments = infer_sibling_group_assignments(players, event_id="event-y")
    assert assignments["p1"]["forceSameTeamWithSibling"] is False
    assert assignments["p2"]["forceSameTeamWithSibling"] is False
    assert assignments["p1"]["siblingGroupId"] is None
    assert assignments["p2"]["siblingGroupId"] is None


def test_infer_sibling_groups_marks_weak_signal_groups_as_suspicious():
    players = [
        {
            "id": "p1",
            "age_group": "U10",
            "parentEmailNormalized": None,
            "cellPhoneNormalized": None,
            "streetNormalized": "123 main st",
            "parentLastNameNormalized": "smith",
            "siblingSeparationRequested": False,
        },
        {
            "id": "p2",
            "age_group": "U10",
            "parentEmailNormalized": None,
            "cellPhoneNormalized": None,
            "streetNormalized": "123 main st",
            "parentLastNameNormalized": "smith",
            "siblingSeparationRequested": False,
        },
    ]

    assignments = infer_sibling_group_assignments(players, event_id="event-z")
    assert assignments["p1"]["forceSameTeamWithSibling"] is True
    assert assignments["p1"]["siblingInferenceSignals"] == ["street_parent_last_name"]
    assert assignments["p1"]["siblingInferenceSuspicious"] is True
    assert "weak_signal_only" in assignments["p1"]["siblingInferenceSuspicionReasons"]


def test_infer_sibling_groups_marks_large_groups_as_suspicious():
    players = []
    for idx in range(1, 5):
        players.append(
            {
                "id": f"p{idx}",
                "age_group": "U10",
                "parentEmailNormalized": "family@example.com",
                "cellPhoneNormalized": "5551112222",
                "streetNormalized": "123 main st",
                "parentLastNameNormalized": "smith",
                "siblingSeparationRequested": False,
            }
        )

    assignments = infer_sibling_group_assignments(players, event_id="event-large")
    assert assignments["p1"]["siblingInferenceSuspicious"] is True
    assert "large_group" in assignments["p1"]["siblingInferenceSuspicionReasons"]
    assert assignments["p1"]["siblingGroupSize"] == 4
    assert sorted(assignments["p1"]["siblingInferenceSignals"]) == [
        "cell_phone",
        "parent_email",
        "street_parent_last_name",
    ]
