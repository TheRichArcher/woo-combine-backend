import unittest
from backend.utils.importers import DataImporter
from backend.services.schema_registry import SchemaRegistry

class TestImporter(unittest.TestCase):
    def setUp(self):
        self.football_schema = SchemaRegistry.get_schema("football")
        self.football_drills = [d.key for d in self.football_schema.drills]
        # Mock drill label map as it would be built in parse function
        self.drill_label_map = {
            d.label.lower().replace(' ', '_').replace('-', '_'): d.key 
            for d in self.football_schema.drills
        }

    def test_normalize_standard_headers(self):
        # Test Case 1: Exact Key
        self.assertEqual(
            DataImporter._normalize_header("40m_dash", self.football_drills, self.drill_label_map),
            "40m_dash"
        )

        # Test Case 2: Label (40-Yard Dash -> 40_yard_dash -> map -> 40m_dash)
        self.assertEqual(
            DataImporter._normalize_header("40-Yard Dash", self.football_drills, self.drill_label_map),
            "40m_dash"
        )

        # Test Case 3: Label Variation (40 Yard Dash -> 40_yard_dash -> map -> 40m_dash)
        self.assertEqual(
            DataImporter._normalize_header("40 Yard Dash", self.football_drills, self.drill_label_map),
            "40m_dash"
        )

        # Test Case 4: Fuzzy Match (40 Yard -> 40m_dash)
        self.assertEqual(
            DataImporter._normalize_header("40 Yard", self.football_drills, self.drill_label_map),
            "40m_dash"
        )

        # Test Case 5: Vertical Jump
        self.assertEqual(
            DataImporter._normalize_header("Vertical Jump", self.football_drills, self.drill_label_map),
            "vertical_jump"
        )
        
        # Test Case 6: Vert Jump (Fuzzy)
        self.assertEqual(
            DataImporter._normalize_header("Vert Jump", self.football_drills, self.drill_label_map),
            "vertical_jump"
        )

    def test_parse_csv_mock(self):
        # Simulate parsing logic
        headers = ["First Name", "Last Name", "40 Yard Dash", "Vertical Jump"]
        normalized = [
            DataImporter._normalize_header(h, self.football_drills, self.drill_label_map) 
            for h in headers
        ]
        
        expected = ["first_name", "last_name", "40m_dash", "vertical_jump"]
        self.assertEqual(normalized, expected)

if __name__ == '__main__':
    unittest.main()








